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
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    const { data, error } = await cloud.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
    const alreadyRegistered = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
    return { user: data.user, needsConfirmation: !data.session && !alreadyRegistered, alreadyRegistered };
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
export async function cloudEmailLink(email) {
  if (!cloud) throw new Error('Облако не настроено.');
  const redirectTo = window.location.origin + import.meta.env.BASE_URL;
  const { error } = await cloud.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo }
  });
  if (error) throw error;
}
export async function cloudVerifyEmailCode(email, token) {
  if (!cloud) throw new Error('Облако не настроено.');
  const { data, error } = await cloud.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (!data?.user) throw new Error('Код принят, но Supabase не вернул пользователя. Проверь настройки Email OTP.');
  return { user: data.user, session: data.session };
}

export async function cloudSendSupportMessage(subject, message) {
  if (!cloud) throw new Error('Облако не настроено.');
  const { data: { session } } = await cloud.auth.getSession();
  if (!session) throw new Error('Сначала войди в аккаунт.');
  const { data, error } = await cloud.functions.invoke('novex-email', {
    body: { subject, message }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
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

export async function cloudPasswordReset(email) {
  if (!cloud) throw new Error('Облако не настроено.');
  const redirectTo = window.location.origin + import.meta.env.BASE_URL;
  const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function cloudUpdatePassword(password) {
  if (!cloud) throw new Error('Облако не настроено.');
  const { data, error } = await cloud.auth.updateUser({ password });
  if (error) throw error;
  return data?.user || null;
}
