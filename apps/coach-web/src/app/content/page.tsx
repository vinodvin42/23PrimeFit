'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachShell } from '../../components/coach-shell';
import { Icon } from '../../components/icons';
import { useCoach } from '../../lib/coach-context';
import styles from '../page.module.css';

type CatalogItem = {
  id: string;
  title: string;
  description: string;
  active: boolean;
  level?: string;
  durationMin?: number;
  daysPerWeek?: number;
  dailyKcal?: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  _count: { items: number; assignments: number };
};

type Asset = {
  id: string;
  name?: string;
  title?: string;
  category?: string | null;
  equipment?: string | null;
  calories?: number;
};

type ClientRow = {
  client: { id: string; displayName?: string | null; email?: string | null };
};

type NutritionContext = {
  client: { id: string; displayName?: string | null; email?: string | null };
  inputs: {
    age: number | null;
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    activityLevel: string | null;
    goals: string[];
    lifestyleDisorders: string[];
    onboardingComplete: boolean;
  };
  missing: string[];
  currentIntake: { calories: number; proteinG: number; carbsG: number; fatG: number };
  activeMealPlan?: { title: string; dailyKcal: number } | null;
  targets: {
    bmr: number;
    tdee: number;
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    calorieAdjustment: number;
    activityFactor: number;
  } | null;
  method: string;
};

const emptyProgram = {
  title: '',
  description: '',
  level: 'Beginner',
  durationMin: 45,
  daysPerWeek: 3,
  goalTags: '',
  imageUrl: '',
  videoUrl: '',
};

const emptyMeal = {
  title: '',
  description: '',
  dailyKcal: 2200,
  goalTags: '',
  imageUrl: '',
  videoUrl: '',
};

const emptyRecipe = {
  title: '',
  summary: '',
  calories: 450,
  proteinG: 30,
  carbsG: 45,
  fatG: 15,
  prepMin: 10,
  cookMin: 15,
  ingredients: '',
  instructions: '',
  tags: '',
};

export default function ContentPage() {
  const { session, api, ready } = useCoach();
  const router = useRouter();
  const [tab, setTab] = useState<'programs' | 'meals'>('programs');
  const [catalog, setCatalog] = useState<{ programs: CatalogItem[]; mealPlans: CatalogItem[] }>({
    programs: [],
    mealPlans: [],
  });
  const [assets, setAssets] = useState<{ exercises: Asset[]; recipes: Asset[] }>({
    exercises: [],
    recipes: [],
  });
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [nutritionContext, setNutritionContext] = useState<NutritionContext | null>(null);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [program, setProgram] = useState(emptyProgram);
  const [meal, setMeal] = useState(emptyMeal);
  const [programItems, setProgramItems] = useState<Array<{
    exerciseId: string;
    dayIndex: number;
    sets: number;
    reps: string;
    restSec: number;
  }>>([]);
  const [mealItems, setMealItems] = useState<Array<{
    recipeId: string;
    dayIndex: number;
    mealType: string;
  }>>([]);
  const [recipe, setRecipe] = useState(emptyRecipe);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [catalogData, assetData, clientRows] = await Promise.all([
      api<{ programs: CatalogItem[]; mealPlans: CatalogItem[] }>('/coach/cms/catalog'),
      api<{ exercises: Asset[]; recipes: Asset[] }>('/coach/cms/assets'),
      api<ClientRow[]>('/coach/clients'),
    ]);
    setCatalog(catalogData);
    setAssets(assetData);
    setClients(
      Array.from(new Map(clientRows.map((row) => [row.client.id, row])).values()),
    );
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace('/');
      return;
    }
    load().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : 'Unable to load content library'),
    );
  }, [load, ready, router, session]);

  async function createProgram() {
    setSaving(true);
    setError(null);
    try {
      await api('/coach/cms/programs', {
        method: 'POST',
        body: JSON.stringify({
          ...program,
          goalTags: program.goalTags.split(',').map((tag) => tag.trim()).filter(Boolean),
          items: programItems.map((item, index) => ({ ...item, sortOrder: index })),
        }),
      });
      setProgram(emptyProgram);
      setProgramItems([]);
      setNotice('Training program published and ready to assign.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save program');
    } finally {
      setSaving(false);
    }
  }

  async function createMealPlan() {
    setSaving(true);
    setError(null);
    try {
      await api('/coach/cms/meal-plans', {
        method: 'POST',
        body: JSON.stringify({
          ...meal,
          goalTags: meal.goalTags.split(',').map((tag) => tag.trim()).filter(Boolean),
          items: mealItems.map((item, index) => ({ ...item, sortOrder: index })),
        }),
      });
      setMeal(emptyMeal);
      setMealItems([]);
      setNotice('Meal plan published and ready to assign.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save meal plan');
    } finally {
      setSaving(false);
    }
  }

  async function createRecipe() {
    setCreatingRecipe(true);
    setError(null);
    try {
      const created = await api<Asset>('/coach/cms/recipes', {
        method: 'POST',
        body: JSON.stringify({
          ...recipe,
          ingredients: recipe.ingredients.split('\n').map((value) => value.trim()).filter(Boolean),
          instructions: recipe.instructions.split('\n').map((value) => value.trim()).filter(Boolean),
          tags: recipe.tags.split(',').map((value) => value.trim()).filter(Boolean),
        }),
      });
      await load();
      setMealItems((current) => [
        ...current,
        { recipeId: created.id, dayIndex: 0, mealType: 'Breakfast' },
      ]);
      setRecipe(emptyRecipe);
      setShowRecipeForm(false);
      setNotice('Recipe added to the library and selected in this meal plan.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create recipe');
    } finally {
      setCreatingRecipe(false);
    }
  }

  async function loadNutritionContext(clientId: string) {
    setSelectedClientId(clientId);
    setNutritionContext(null);
    if (!clientId) return;
    setLoadingNutrition(true);
    setError(null);
    try {
      const context = await api<NutritionContext>(
        `/coach/cms/clients/${clientId}/nutrition-targets`,
      );
      setNutritionContext(context);
    } catch (contextError) {
      setError(
        contextError instanceof Error
          ? contextError.message
          : 'Unable to calculate nutrition targets',
      );
    } finally {
      setLoadingNutrition(false);
    }
  }

  async function archive(kind: 'programs' | 'meal-plans', id: string) {
    if (!window.confirm('Archive this content? Existing client assignments will be preserved.')) return;
    await api(`/coach/cms/${kind}/${id}`, { method: 'DELETE' });
    setNotice('Content archived.');
    await load();
  }

  async function uploadMedia(
    file: File,
    kind: 'image' | 'video',
    target: 'program' | 'meal',
  ) {
    if (file.size > 20 * 1024 * 1024) {
      setError('Media files must be 20 MB or smaller.');
      return;
    }
    setUploading(`${target}-${kind}`);
    setError(null);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read media file'));
        reader.readAsDataURL(file);
      });
      const stored = await api<{ fileUrl: string }>('/coach/cms/media', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
          kind,
        }),
      });
      const field = kind === 'image' ? 'imageUrl' : 'videoUrl';
      if (target === 'program') setProgram((current) => ({ ...current, [field]: stored.fileUrl }));
      else setMeal((current) => ({ ...current, [field]: stored.fileUrl }));
      setNotice(`${kind === 'image' ? 'Image' : 'Video'} uploaded.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Media upload failed');
    } finally {
      setUploading(null);
    }
  }

  function suggestMealDay() {
    if (!assets.recipes.length) {
      setError('Add or import recipes before generating a meal structure.');
      return;
    }
    const mealTargets = [
      { mealType: 'Breakfast', ratio: 0.25 },
      { mealType: 'Lunch', ratio: 0.3 },
      { mealType: 'Dinner', ratio: 0.3 },
      { mealType: 'Snack', ratio: 0.15 },
    ];
    const available = [...assets.recipes];
    setMealItems(
      mealTargets.map(({ mealType, ratio }) => {
        const target = meal.dailyKcal * ratio;
        const pool = available.length ? available : assets.recipes;
        const recipe = pool.reduce((closest, candidate) =>
          Math.abs((candidate.calories ?? 0) - target) <
          Math.abs((closest.calories ?? 0) - target)
            ? candidate
            : closest,
        );
        const usedIndex = available.findIndex((item) => item.id === recipe.id);
        if (usedIndex >= 0) available.splice(usedIndex, 1);
        return { recipeId: recipe.id, dayIndex: 0, mealType };
      }),
    );
    setNotice('A balanced one-day meal structure was suggested. Review before publishing.');
  }

  if (!ready || !session) {
    return <CoachShell><div className={styles.pageLoader}>Opening content studio…</div></CoachShell>;
  }

  const items = tab === 'programs' ? catalog.programs : catalog.mealPlans;
  const suggestedCalories = mealItems.reduce((sum, item) => {
    const recipe = assets.recipes.find((asset) => asset.id === item.recipeId);
    return sum + (recipe?.calories ?? 0);
  }, 0);

  return (
    <CoachShell>
      <div className={styles.featurePage}>
        {notice ? <div className={styles.cmsNotice}><Icon name="check" size={17} />{notice}<button onClick={() => setNotice(null)} type="button">×</button></div> : null}
        {error ? <div className={styles.inlineError}><Icon name="warning" size={17} />{error}</div> : null}
        <div className={styles.cmsWorkspace}>
          <section className={styles.cmsLibrary}>
            <header className={styles.cmsPanelHeader}>
              <div><h3>Content library</h3><p>Create reusable plans for your client roster.</p></div>
              <span>{catalog.programs.length + catalog.mealPlans.length} items</span>
            </header>
            <div className={styles.cmsTabs}>
              <button type="button" className={tab === 'programs' ? styles.cmsTabActive : ''} onClick={() => setTab('programs')}>
                <Icon name="dumbbell" size={16} /> Training programs
              </button>
              <button type="button" className={tab === 'meals' ? styles.cmsTabActive : ''} onClick={() => setTab('meals')}>
                <Icon name="heart" size={16} /> Meal plans
              </button>
            </div>
            <div className={styles.cmsList}>
              {items.map((item) => (
                <article className={styles.cmsCard} key={item.id}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.cmsCardImage} src={item.imageUrl} alt="" />
                  ) : (
                    <span className={styles.cmsCardIcon}><Icon name={tab === 'programs' ? 'dumbbell' : 'heart'} size={18} /></span>
                  )}
                  <div>
                    <div className={styles.cmsCardTitle}><h4>{item.title}</h4><span>{item.active ? 'Published' : 'Archived'}</span></div>
                    <p>{item.description}</p>
                    <div className={styles.cmsCardMeta}>
                      {item.level ? <span>{item.level}</span> : null}
                      {item.durationMin ? <span>{item.durationMin} min</span> : null}
                      {item.daysPerWeek ? <span>{item.daysPerWeek} days/week</span> : null}
                      {item.dailyKcal ? <span>{item.dailyKcal} kcal</span> : null}
                      <span>{item._count.items} items</span>
                      <span>{item._count.assignments} assigned</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => archive(tab === 'programs' ? 'programs' : 'meal-plans', item.id)}>Archive</button>
                </article>
              ))}
              {items.length === 0 ? <div className={styles.detailEmpty}><Icon name="plus" size={25} /><h3>No content yet</h3><p>Use the builder to publish your first plan.</p></div> : null}
            </div>
          </section>

          <section className={styles.cmsBuilder}>
            <header className={styles.cmsPanelHeader}>
              <div><h3>{tab === 'programs' ? 'New training program' : 'New meal plan'}</h3><p>Published content appears in client assignment menus.</p></div>
            </header>
            {tab === 'programs' ? (
              <div className={styles.cmsForm}>
                <label>Program title<input value={program.title} onChange={(event) => setProgram({ ...program, title: event.target.value })} placeholder="e.g. Foundation Strength" /></label>
                <label className={styles.cmsFull}>Description<textarea value={program.description} onChange={(event) => setProgram({ ...program, description: event.target.value })} placeholder="Who this program is for and what it delivers" rows={3} /></label>
                <label>Level<select value={program.level} onChange={(event) => setProgram({ ...program, level: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
                <label>Session length<input type="number" min="5" value={program.durationMin} onChange={(event) => setProgram({ ...program, durationMin: Number(event.target.value) })} /></label>
                <label>Days per week<input type="number" min="1" max="7" value={program.daysPerWeek} onChange={(event) => setProgram({ ...program, daysPerWeek: Number(event.target.value) })} /></label>
                <label>Goal tags<input value={program.goalTags} onChange={(event) => setProgram({ ...program, goalTags: event.target.value })} placeholder="strength, mobility" /></label>
                <div className={`${styles.cmsFull} ${styles.mediaFields}`}>
                  <label className={styles.mediaUpload}>
                    <Icon name="plus" size={17} />
                    <span><strong>Cover image</strong><small>JPG, PNG or WebP · max 20 MB</small></span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void uploadMedia(event.target.files[0], 'image', 'program')} />
                    <em>{uploading === 'program-image' ? 'Uploading…' : program.imageUrl ? 'Uploaded' : 'Choose image'}</em>
                  </label>
                  <label className={styles.mediaUpload}>
                    <Icon name="activity" size={17} />
                    <span><strong>Introduction video</strong><small>MP4, WebM or MOV · max 20 MB</small></span>
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => event.target.files?.[0] && void uploadMedia(event.target.files[0], 'video', 'program')} />
                    <em>{uploading === 'program-video' ? 'Uploading…' : program.videoUrl ? 'Uploaded' : 'Choose video'}</em>
                  </label>
                </div>
                <div className={styles.cmsFull}>
                  <div className={styles.builderSectionTitle}><div><h4>Exercises</h4><p>Add exercises in delivery order.</p></div><button type="button" onClick={() => setProgramItems([...programItems, { exerciseId: assets.exercises[0]?.id ?? '', dayIndex: 0, sets: 3, reps: '10', restSec: 60 }])}><Icon name="plus" size={14} /> Add exercise</button></div>
                  <div className={styles.builderRows}>
                    {programItems.map((item, index) => (
                      <div className={styles.builderRow} key={index}>
                        <select value={item.exerciseId} onChange={(event) => setProgramItems(programItems.map((row, rowIndex) => rowIndex === index ? { ...row, exerciseId: event.target.value } : row))}>
                          <option value="">Select exercise</option>
                          {assets.exercises.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                        </select>
                        <label>Day<input type="number" min="1" value={item.dayIndex + 1} onChange={(event) => setProgramItems(programItems.map((row, rowIndex) => rowIndex === index ? { ...row, dayIndex: Number(event.target.value) - 1 } : row))} /></label>
                        <label>Sets<input type="number" min="1" value={item.sets} onChange={(event) => setProgramItems(programItems.map((row, rowIndex) => rowIndex === index ? { ...row, sets: Number(event.target.value) } : row))} /></label>
                        <label>Reps<input value={item.reps} onChange={(event) => setProgramItems(programItems.map((row, rowIndex) => rowIndex === index ? { ...row, reps: event.target.value } : row))} /></label>
                        <button type="button" aria-label="Remove exercise" onClick={() => setProgramItems(programItems.filter((_, rowIndex) => rowIndex !== index))}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
                <button className={`${styles.primaryButton} ${styles.cmsPublish}`} type="button" onClick={createProgram} disabled={saving || !program.title || !program.description}>
                  <Icon name="check" size={16} /> {saving ? 'Publishing…' : 'Publish program'}
                </button>
              </div>
            ) : (
              <div className={styles.cmsForm}>
                <label>Plan title<input value={meal.title} onChange={(event) => setMeal({ ...meal, title: event.target.value })} placeholder="e.g. Lean Performance" /></label>
                <label>Daily calories<input type="number" min="500" value={meal.dailyKcal} onChange={(event) => setMeal({ ...meal, dailyKcal: Number(event.target.value) })} /></label>
                <label className={styles.cmsFull}>Description<textarea value={meal.description} onChange={(event) => setMeal({ ...meal, description: event.target.value })} placeholder="Plan objectives and guidance" rows={3} /></label>
                <label className={styles.cmsFull}>Goal tags<input value={meal.goalTags} onChange={(event) => setMeal({ ...meal, goalTags: event.target.value })} placeholder="fat loss, high protein" /></label>
                <section className={`${styles.cmsFull} ${styles.nutritionCalculator}`}>
                  <header>
                    <div>
                      <span><Icon name="activity" size={17} /></span>
                      <div><h4>Client nutrition calculator</h4><p>Use profile and activity data already collected from the client.</p></div>
                    </div>
                    <select value={selectedClientId} onChange={(event) => void loadNutritionContext(event.target.value)}>
                      <option value="">Select a client</option>
                      {clients.map((row) => (
                        <option key={row.client.id} value={row.client.id}>
                          {row.client.displayName || row.client.email || row.client.id}
                        </option>
                      ))}
                    </select>
                  </header>
                  {loadingNutrition ? <div className={styles.calculatorLoading}>Calculating targets from client data…</div> : null}
                  {nutritionContext ? (
                    <>
                      <div className={styles.clientDataGrid}>
                        <article><small>Age</small><strong>{nutritionContext.inputs.age ?? 'Missing'}</strong></article>
                        <article><small>Sex</small><strong>{nutritionContext.inputs.sex?.replaceAll('_', ' ') ?? 'Missing'}</strong></article>
                        <article><small>Height</small><strong>{nutritionContext.inputs.heightCm ? `${nutritionContext.inputs.heightCm} cm` : 'Missing'}</strong></article>
                        <article><small>Weight</small><strong>{nutritionContext.inputs.weightKg ? `${nutritionContext.inputs.weightKg} kg` : 'Missing'}</strong></article>
                        <article><small>Activity</small><strong>{nutritionContext.inputs.activityLevel?.replaceAll('_', ' ') ?? 'Missing'}</strong></article>
                        <article><small>Goals</small><strong>{nutritionContext.inputs.goals.length ? nutritionContext.inputs.goals.map((goal) => goal.replaceAll('_', ' ')).join(', ') : 'Not set'}</strong></article>
                        <article><small>Health context</small><strong>{nutritionContext.inputs.lifestyleDisorders.length ? nutritionContext.inputs.lifestyleDisorders.join(', ') : 'None reported'}</strong></article>
                        <article><small>Current plan</small><strong>{nutritionContext.activeMealPlan?.title ?? 'None assigned'}</strong></article>
                      </div>
                      <div className={styles.currentIntakeRow}>
                        <span>Today logged</span>
                        <strong>{Math.round(nutritionContext.currentIntake.calories)} kcal</strong>
                        <span>{Math.round(nutritionContext.currentIntake.proteinG)}g protein</span>
                        <span>{Math.round(nutritionContext.currentIntake.carbsG)}g carbs</span>
                        <span>{Math.round(nutritionContext.currentIntake.fatG)}g fat</span>
                      </div>
                      {nutritionContext.targets ? (
                        <div className={styles.targetResults}>
                          <article><small>BMR</small><strong>{nutritionContext.targets.bmr}</strong><span>kcal at rest</span></article>
                          <article><small>TDEE</small><strong>{nutritionContext.targets.tdee}</strong><span>maintenance kcal</span></article>
                          <article className={styles.primaryTarget}><small>Daily target</small><strong>{nutritionContext.targets.dailyCalories}</strong><span>{nutritionContext.targets.calorieAdjustment >= 0 ? '+' : ''}{nutritionContext.targets.calorieAdjustment} kcal goal adjustment</span></article>
                          <article><small>Macros</small><strong>{nutritionContext.targets.proteinG}P · {nutritionContext.targets.carbsG}C · {nutritionContext.targets.fatG}F</strong><span>grams per day</span></article>
                          <button
                            type="button"
                            onClick={() => {
                              setMeal({ ...meal, dailyKcal: nutritionContext.targets!.dailyCalories });
                              setNotice('Calculated calorie target applied to this meal plan.');
                            }}
                          >
                            Apply {nutritionContext.targets.dailyCalories} kcal target
                          </button>
                        </div>
                      ) : (
                        <div className={styles.missingDataNotice}>
                          <Icon name="warning" size={16} />
                          <div>
                            <strong>More client data is needed</strong>
                            <p>Ask the client to complete: {nutritionContext.missing.map((field) => field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}.</p>
                          </div>
                        </div>
                      )}
                      <p className={styles.calculationMethod}>
                        Estimate uses the {nutritionContext.method} equation and the client&apos;s recorded activity and goal. Coach review is required.
                      </p>
                    </>
                  ) : !loadingNutrition ? (
                    <div className={styles.calculatorEmpty}>Select a client to see available data, missing fields, current intake and calculated targets.</div>
                  ) : null}
                </section>
                <div className={`${styles.cmsFull} ${styles.mediaFields}`}>
                  <label className={styles.mediaUpload}>
                    <Icon name="plus" size={17} />
                    <span><strong>Plan cover image</strong><small>JPG, PNG or WebP · max 20 MB</small></span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void uploadMedia(event.target.files[0], 'image', 'meal')} />
                    <em>{uploading === 'meal-image' ? 'Uploading…' : meal.imageUrl ? 'Uploaded' : 'Choose image'}</em>
                  </label>
                  <label className={styles.mediaUpload}>
                    <Icon name="activity" size={17} />
                    <span><strong>Plan guidance video</strong><small>MP4, WebM or MOV · max 20 MB</small></span>
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => event.target.files?.[0] && void uploadMedia(event.target.files[0], 'video', 'meal')} />
                    <em>{uploading === 'meal-video' ? 'Uploading…' : meal.videoUrl ? 'Uploaded' : 'Choose video'}</em>
                  </label>
                </div>
                <div className={`${styles.cmsFull} ${styles.recipeLibraryPanel}`}>
                  <div className={styles.builderSectionTitle}>
                    <div><h4>Recipe library</h4><p>{assets.recipes.length} recipes available for meal plans.</p></div>
                    <button type="button" onClick={() => setShowRecipeForm((value) => !value)}>
                      <Icon name={showRecipeForm ? 'chevron' : 'plus'} size={14} />
                      {showRecipeForm ? 'Close creator' : 'Create recipe'}
                    </button>
                  </div>
                  {showRecipeForm ? (
                    <div className={styles.recipeCreator}>
                      <label>Recipe name<input value={recipe.title} onChange={(event) => setRecipe({ ...recipe, title: event.target.value })} placeholder="e.g. Tandoori Chicken Bowl" /></label>
                      <label>Calories<input type="number" min="0" value={recipe.calories} onChange={(event) => setRecipe({ ...recipe, calories: Number(event.target.value) })} /></label>
                      <label>Protein (g)<input type="number" min="0" value={recipe.proteinG} onChange={(event) => setRecipe({ ...recipe, proteinG: Number(event.target.value) })} /></label>
                      <label>Carbs (g)<input type="number" min="0" value={recipe.carbsG} onChange={(event) => setRecipe({ ...recipe, carbsG: Number(event.target.value) })} /></label>
                      <label>Fat (g)<input type="number" min="0" value={recipe.fatG} onChange={(event) => setRecipe({ ...recipe, fatG: Number(event.target.value) })} /></label>
                      <label>Prep minutes<input type="number" min="0" value={recipe.prepMin} onChange={(event) => setRecipe({ ...recipe, prepMin: Number(event.target.value) })} /></label>
                      <label>Cook minutes<input type="number" min="0" value={recipe.cookMin} onChange={(event) => setRecipe({ ...recipe, cookMin: Number(event.target.value) })} /></label>
                      <label>Tags<input value={recipe.tags} onChange={(event) => setRecipe({ ...recipe, tags: event.target.value })} placeholder="high protein, vegetarian" /></label>
                      <label className={styles.recipeWide}>Summary<input value={recipe.summary} onChange={(event) => setRecipe({ ...recipe, summary: event.target.value })} placeholder="Short nutrition or preparation note" /></label>
                      <label className={styles.recipeWide}>Ingredients<textarea rows={4} value={recipe.ingredients} onChange={(event) => setRecipe({ ...recipe, ingredients: event.target.value })} placeholder={'One ingredient per line\n150 g chicken breast\n100 g cooked rice'} /></label>
                      <label className={styles.recipeWide}>Instructions<textarea rows={4} value={recipe.instructions} onChange={(event) => setRecipe({ ...recipe, instructions: event.target.value })} placeholder={'One step per line\nSeason and grill chicken\nAssemble the bowl'} /></label>
                      <button className={styles.createRecipeButton} type="button" onClick={createRecipe} disabled={creatingRecipe || !recipe.title}>
                        <Icon name="check" size={15} /> {creatingRecipe ? 'Creating…' : 'Create and add recipe'}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className={styles.cmsFull}>
                  <div className={styles.builderSectionTitle}>
                    <div><h4>Meals and suggestions</h4><p>Build each day from your recipe library.</p></div>
                    <div className={styles.builderTitleActions}>
                      <button type="button" onClick={suggestMealDay}><Icon name="sparkles" size={14} /> Suggest day</button>
                      <button type="button" onClick={() => setMealItems([...mealItems, { recipeId: assets.recipes[0]?.id ?? '', dayIndex: 0, mealType: 'Breakfast' }])}><Icon name="plus" size={14} /> Add meal</button>
                    </div>
                  </div>
                  <div className={styles.builderRows}>
                    {mealItems.map((item, index) => (
                      <div className={`${styles.builderRow} ${styles.mealBuilderRow}`} key={index}>
                        <select value={item.recipeId} onChange={(event) => setMealItems(mealItems.map((row, rowIndex) => rowIndex === index ? { ...row, recipeId: event.target.value } : row))}>
                          <option value="">Select recipe</option>
                          {assets.recipes.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
                        </select>
                        <label>Day<input type="number" min="1" value={item.dayIndex + 1} onChange={(event) => setMealItems(mealItems.map((row, rowIndex) => rowIndex === index ? { ...row, dayIndex: Number(event.target.value) - 1 } : row))} /></label>
                        <label>Meal<select value={item.mealType} onChange={(event) => setMealItems(mealItems.map((row, rowIndex) => rowIndex === index ? { ...row, mealType: event.target.value } : row))}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
                        <button type="button" aria-label="Remove meal" onClick={() => setMealItems(mealItems.filter((_, rowIndex) => rowIndex !== index))}>×</button>
                      </div>
                    ))}
                  </div>
                  {mealItems.length ? (
                    <div className={styles.mealPlanSummary}>
                      <span><strong>{mealItems.length}</strong> meals</span>
                      <span><strong>{Math.round(suggestedCalories)}</strong> planned kcal</span>
                      <span><strong>{meal.dailyKcal}</strong> target kcal</span>
                    </div>
                  ) : null}
                </div>
                <button className={`${styles.primaryButton} ${styles.cmsPublish}`} type="button" onClick={createMealPlan} disabled={saving || !meal.title || !meal.description}>
                  <Icon name="check" size={16} /> {saving ? 'Publishing…' : 'Publish meal plan'}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}
