import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const cloudConfigured = Boolean(url && key);
export const cloud = cloudConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export async function cloudSession() {
  if (!cloud) return { user: null, error: null };
  const { data, error } = await cloud.auth.getSession();
  return { user: data?.session?.user || null, error };
}
export async function cloudAuth(mode, email, password) {
  if (!cloud) throw new Error('Облако не настроено. Нужны VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в GitHub Actions Variables.');
  if (mode === 'signup') {
    const { data, error } = await cloud.auth.signUp({ email, password });
    if (error) throw error;
    return { user: data.user, needsConfirmation: !data.session };
  }
  if (mode === 'login') {
    const { data, error } = await cloud.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: data.user, needsConfirmation: false };
  }
  const { error } = await cloud.auth.signOut();
  if (error) throw error;
  return { user: null, needsConfirmation: false };
}
export async function cloudListProjects() {
  if (!cloud) return [];
  const { data, error } = await cloud.from('novex_projects').select('id,name,summary,project_data,created_at,updated_at').order('updated_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}
export async function cloudSaveProject(project) {
  if (!cloud) throw new Error('Облако не настроено.');
  const { data: { user }, error: userError } = await cloud.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Войди в аккаунт, чтобы сохранять проекты в облаке.');
  const payload = {
    user_id: user.id,
    name: String(project.name || 'Untitled project').slice(0, 120),
    summary: String(project.summary || '').slice(0, 500),
    project_data: project.project_data || {}
  };
  const { data, error } = await cloud.from('novex_projects').insert(payload).select().single();
  if (error) throw error;
  return data;
}
