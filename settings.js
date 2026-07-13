function getSupabaseClient() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    return window.supabase.createClient(
      "https://lbxpucsgwgtamolvjuep.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHB1Y3Nnd2d0YW1vbHZqdWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM1MjcsImV4cCI6MjA4NzA2OTUyN30.KvC6zRMZtE8owQiXleNqlQvaoKoYL-NQQJr0928K3iY"
    );
  }
  return null;
}

const supabaseClient = getSupabaseClient();

const statusEl = document.getElementById('settingsStatus');
const usernameForm = document.getElementById('usernameForm');
const usernameInput = document.getElementById('newUsername');
const avatarForm = document.getElementById('avatarForm');
const avatarPathInput = document.getElementById('avatarPath');
const avatarPreview = document.getElementById('avatarPreview');
const avatarDropdown = document.getElementById('avatarDropdown');
const avatarDropdownToggle = document.getElementById('avatarDropdownToggle');
const avatarDropdownMenu = document.getElementById('avatarDropdownMenu');
const avatarDropdownThumb = document.getElementById('avatarDropdownThumb');
const avatarDropdownLabel = document.getElementById('avatarDropdownLabel');
const avatarSearchInput = document.getElementById('avatarSearch');
const avatarOptionsList = document.getElementById('avatarOptionsList');
const usernameMessage = document.getElementById('usernameMessage');
const avatarMessage = document.getElementById('avatarMessage');
const signOutBtn = document.getElementById('profileSignOut');
const USERNAME_REGEX = /^[a-z0-9_]{3,32}$/;
const AVATAR_FALLBACK_OPTIONS = [
  '/images/avatars/avatar-1.jpg',
  '/images/avatars/avatar-2.jpg',
  '/images/avatars/avatar-3.jpg',
  '/images/avatars/avatar-4.jpg',
  '/images/avatars/avatar-5.jpg',
  '/images/avatars/avatar-6.jpg',
  '/images/avatars/avatar-7.jpg',
  '/images/avatars/avatar-8.jpg',
  '/images/avatars/avatar-9.jpg',
  '/images/avatars/avatar-10.jpg',
  '/images/avatars/avatar-11.jpg',
  '/images/avatars/avatar-12.jpg',
  '/images/avatars/avatar-13.jpg',
  '/images/avatars/avatar-14.jpg',
  '/images/avatars/avatar-16.jpg',
  '/images/avatars/avatar-17.jpg',
  '/images/avatars/avatar-18.jpg',
  '/images/avatars/avatar-19.jpg',
  '/images/avatars/avatar-20.jpg',
  '/images/avatars/avatar-21.jpg',
  '/images/avatars/avatar-22.jpg',
  '/images/avatars/avatar-23.jpg',
  '/images/avatars/avatar-24.jpg',
  '/images/avatars/avatar-25.jpg',
  '/images/avatars/avatar-26.jpg',
  '/images/avatars/avatar-27.jpg',
  '/images/avatars/avatar-28.jpg'
];
let avatarOptions = [...AVATAR_FALLBACK_OPTIONS];

let currentUsername = null;
let currentAvatar = null;

const setStatus = (text, tone = 'neutral') => {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
};

const setUsernameMessage = (text, tone = 'neutral') => {
  if (!usernameMessage) return;
  usernameMessage.textContent = text;
  usernameMessage.dataset.tone = tone;
};

const setAvatarMessage = (text, tone = 'neutral') => {
  if (!avatarMessage) return;
  avatarMessage.textContent = text;
  avatarMessage.dataset.tone = tone;
};

const setButtonLoading = (form, isLoading, defaultText) => {
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Working...' : defaultText;
  }
};

const deriveUsername = (email) => {
  if (!email) return 'listener';
  const base = email.split('@')[0] || 'listener';
  return base.slice(0, 32);
};

const normalizeAvatar = (path) => {
  const raw = String(path || '').trim().replace(/\\/g, '/');
  if (!raw) return '/images/avatars/avatar-1.jpg';
  const avatarMatch = raw.match(/avatar[_-]?(\d+)\.(?:jpe?g|png|webp|gif)$/i);
  if (avatarMatch) return `/images/avatars/avatar-${Number(avatarMatch[1])}.jpg`;
  if (/^\/images\/avatars\/avatar-\d+\.jpg$/i.test(raw)) return raw.toLowerCase();
  return '/images/avatars/avatar-1.jpg';
};

const buildAvatarLabel = (avatarPath) => {
  const file = avatarPath.split('/').pop() || '';
  const base = file.replace(/\.[^/.]+$/, '');
  return base === 'avatar-1' ? 'avatar-1 (default)' : base;
};

const normalizeAvatarSearchText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const avatarMatchesQuery = (avatarPath, query) => {
  const normalizedQuery = normalizeAvatarSearchText(query);
  if (!normalizedQuery) return true;

  const label = buildAvatarLabel(avatarPath);
  const normalizedLabel = normalizeAvatarSearchText(label);
  if (normalizedLabel.includes(normalizedQuery)) return true;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  return queryTokens.every((token) => normalizedLabel.includes(token));
};

const sortAvatarOptions = (paths) => {
  const hasAvatarWord = (value) => /avatar/i.test(String(value || '').split('/').pop() || '');
  return [...paths].sort((a, b) => {
    const aHasAvatar = hasAvatarWord(a);
    const bHasAvatar = hasAvatarWord(b);
    if (aHasAvatar !== bHasAvatar) return aHasAvatar ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
};

const populateAvatarOptions = () => {
  if (!avatarOptionsList) return;
  const selected = normalizeAvatar(avatarPathInput ? avatarPathInput.value : '');
  const query = avatarSearchInput ? avatarSearchInput.value.trim().toLowerCase() : '';
  avatarOptionsList.innerHTML = '';

  const filtered = avatarOptions.filter((avatarPath) => {
    return avatarMatchesQuery(avatarPath, query);
  });

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'avatar-empty';
    empty.textContent = 'No avatars match your search.';
    avatarOptionsList.appendChild(empty);
    return;
  }

  filtered.forEach((avatarPath) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `avatar-option-item${avatarPath === selected ? ' is-selected' : ''}`;
    option.dataset.value = avatarPath;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', avatarPath === selected ? 'true' : 'false');
    option.innerHTML = `<img src="${avatarPath}" alt="${buildAvatarLabel(avatarPath)}"><span>${buildAvatarLabel(avatarPath)}</span>`;
    avatarOptionsList.appendChild(option);
  });
};

const updateAvatarDropdownSelected = (avatarPath) => {
  const normalized = normalizeAvatar(avatarPath);
  if (avatarDropdownThumb) avatarDropdownThumb.src = normalized;
  if (avatarDropdownLabel) avatarDropdownLabel.textContent = buildAvatarLabel(normalized);
};

const setSelectedAvatar = (avatarPath) => {
  const normalized = normalizeAvatar(avatarPath);
  if (avatarPathInput) avatarPathInput.value = normalized;
  if (avatarPreview) avatarPreview.src = normalized;
  updateAvatarDropdownSelected(normalized);
  populateAvatarOptions();
  return normalized;
};

const setAvatarDropdownOpen = (open) => {
  if (!avatarDropdownMenu || !avatarDropdownToggle) return;
  avatarDropdownMenu.hidden = !open;
  avatarDropdownToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && avatarSearchInput) {
    avatarSearchInput.focus();
    avatarSearchInput.select();
  }
};

async function hydrateAvatarOptionsFromDirectory() {
  try {
    const res = await fetch('/images/avatars/');
    if (!res.ok) return;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const discovered = Array.from(doc.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') || '')
      .map((href) => decodeURIComponent(href.split('?')[0].split('#')[0]))
      .filter((href) => /\.(png|jpe?g|webp|gif)$/i.test(href))
      .map((href) => href.replace(/^\.\//, '').replace(/^\//, ''))
      .map((href) => `/images/avatars/${href.split('/').pop()}`);

    if (discovered.length) {
      const unique = Array.from(new Set(discovered));
      avatarOptions = sortAvatarOptions(unique);
    }
  } catch (error) {
    // Keep fallback list if directory listing is unavailable.
  }
}

const formatDate = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

async function getProfile(user) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, avatar_url, joined_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.error('Profile fetch error:', error);
  }
  return data || null;
}

async function upsertProfile(user, username, avatarUrl) {
  if (!supabaseClient) return { error: new Error('Supabase unavailable') };
  const { error } = await supabaseClient.from('profiles').upsert({
    id: user.id,
    username,
    avatar_url: avatarUrl,
    joined_at: user.created_at,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  return { error };
}

async function ensureProfile(user) {
  const existing = await getProfile(user);
  if (existing) return existing;
  const username = deriveUsername(user.email);
  const avatarUrl = '/images/avatars/avatar-1.jpg';
  await upsertProfile(user, username, avatarUrl);
  return { username, avatar_url: avatarUrl, joined_at: user.created_at };
}

async function loadSettings() {
  if (!supabaseClient) {
    setStatus('Supabase not available. Please refresh.', 'error');
    return;
  }

  await hydrateAvatarOptionsFromDirectory();
  setStatus('Loading settings...', 'neutral');

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) {
    setStatus('Session error: ' + sessionError.message, 'error');
    return;
  }
  const session = sessionData ? sessionData.session : null;
  if (!session) {
    window.location.href = '/sign-in.html';
    return;
  }

  const user = session.user;
  const profile = await ensureProfile(user);
  const username = profile && profile.username ? profile.username : deriveUsername(user.email);
  const avatar = profile && profile.avatar_url ? normalizeAvatar(profile.avatar_url) : '/images/avatars/avatar-1.jpg';

  currentUsername = username;
  currentAvatar = avatar;

  if (usernameInput) usernameInput.value = username;
  setSelectedAvatar(avatar);

  localStorage.setItem('emdb_logged_in', 'true');
  if (user.email) localStorage.setItem('emdb_user_email', user.email);
  if (user.id) localStorage.setItem('emdb_user_id', user.id);
  localStorage.setItem('emdb_user_name', username);
  localStorage.setItem('emdb_user_avatar', avatar);

  // No status needed on load; keep clean.
  setStatus('');
}

loadSettings();

if (usernameForm) {
  usernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      setUsernameMessage('Supabase not available. Please refresh.', 'error');
      return;
    }

    const sessionRes = await supabaseClient.auth.getSession();
    const session = sessionRes.data ? sessionRes.data.session : null;
    const user = session ? session.user : null;
    if (!user) {
      window.location.href = '/sign-in.html';
      return;
    }

    const nextUsernameRaw = (usernameInput ? usernameInput.value.trim() : '').slice(0, 32);
    const nextUsername = nextUsernameRaw.toLowerCase();

    if (!USERNAME_REGEX.test(nextUsername)) {
      setUsernameMessage('Username must be 3–32 characters of lowercase letters, numbers, or underscores.', 'error');
      return;
    }

    setButtonLoading(usernameForm, true, 'Save username');
    setUsernameMessage('Saving...', 'neutral');

    const normalizedAvatar = currentAvatar ? normalizeAvatar(currentAvatar) : '/images/avatars/avatar-1.jpg';

    const { data: taken, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('username', nextUsername)
      .neq('id', user.id)
      .limit(1);

    if (checkError) {
      setButtonLoading(usernameForm, false, 'Save username');
      setUsernameMessage('Error checking username: ' + checkError.message, 'error');
      return;
    }

    if (taken && taken.length) {
      setButtonLoading(usernameForm, false, 'Save username');
      setUsernameMessage('That username is taken. Please choose another.', 'error');
      return;
    }

    const { error: upsertError } = await upsertProfile(user, nextUsername, normalizedAvatar);
    setButtonLoading(usernameForm, false, 'Save username');

    if (upsertError) {
      setUsernameMessage('Error saving profile: ' + upsertError.message, 'error');
      return;
    }

    currentUsername = nextUsername;
    if (avatarPreview) avatarPreview.src = normalizedAvatar;
    localStorage.setItem('emdb_user_name', nextUsername);
    localStorage.setItem('emdb_user_avatar', normalizedAvatar);
    setUsernameMessage('Profile updated.', 'success');
  });
}

if (avatarForm) {
  avatarForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      setAvatarMessage('Supabase not available. Please refresh.', 'error');
      return;
    }

    const sessionRes = await supabaseClient.auth.getSession();
    const session = sessionRes.data ? sessionRes.data.session : null;
    const user = session ? session.user : null;
    if (!user) {
      window.location.href = '/sign-in.html';
      return;
    }

    const avatarPath = (avatarPathInput ? avatarPathInput.value.trim() : '') || '/images/avatars/avatar-1.jpg';
    const normalizedAvatar = normalizeAvatar(avatarPath);

    setButtonLoading(avatarForm, true, 'Save avatar');
    setAvatarMessage('Saving...', 'neutral');

    const { error: upsertError } = await upsertProfile(user, currentUsername || deriveUsername(user.email), normalizedAvatar);
    setButtonLoading(avatarForm, false, 'Save avatar');

    if (upsertError) {
      setAvatarMessage('Error saving avatar: ' + upsertError.message, 'error');
      return;
    }

    currentAvatar = normalizedAvatar;
    setSelectedAvatar(normalizedAvatar);
    localStorage.setItem('emdb_user_avatar', normalizedAvatar);
    setAvatarMessage('Avatar updated.', 'success');
  });
}

if (avatarPathInput) {
  setSelectedAvatar(avatarPathInput.value || '/images/avatars/avatar-1.jpg');
}

if (avatarDropdownToggle) {
  avatarDropdownToggle.addEventListener('click', () => {
    const isOpen = avatarDropdownMenu && !avatarDropdownMenu.hidden;
    setAvatarDropdownOpen(!isOpen);
  });
}

if (avatarSearchInput) {
  avatarSearchInput.addEventListener('input', () => {
    populateAvatarOptions();
  });
}

if (avatarOptionsList) {
  avatarOptionsList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    const selected = setSelectedAvatar(button.dataset.value || '');
    currentAvatar = selected;
    setAvatarMessage('Selected. Click Save avatar to apply.', 'neutral');
    setAvatarDropdownOpen(false);
  });
}

document.addEventListener('click', (event) => {
  if (!avatarDropdown || !avatarDropdownMenu || avatarDropdownMenu.hidden) return;
  if (avatarDropdown.contains(event.target)) return;
  setAvatarDropdownOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setAvatarDropdownOpen(false);
  }
});

if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    if (!supabaseClient) {
      setStatus('Supabase not available. Please refresh.', 'error');
      return;
    }

    setStatus('Signing out...', 'neutral');
    await supabaseClient.auth.signOut();
    localStorage.removeItem('emdb_logged_in');
    localStorage.removeItem('emdb_user_email');
    localStorage.removeItem('emdb_user_id');
    localStorage.removeItem('emdb_user_name');
    localStorage.removeItem('emdb_user_avatar');
    window.location.href = '/sign-in.html';
  });
}
