const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const parseResponse = async (response) => {
  const result = await response.json();

  if (!response.ok) {
    const message =
      response.status === 403
        ? 'You do not have permission to perform this action.'
        : response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : result.message || 'Request failed.';
    const error = new Error(message);
    error.status = response.status;
    error.code =
      result.code ||
      (response.status === 403
        ? 'FORBIDDEN'
        : response.status === 401
          ? 'UNAUTHORIZED'
          : undefined);
    throw error;
  }

  return result;
};

export const api = {
  baseUrl: API_BASE_URL,

  health: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return parseResponse(response);
  },

  login: async ({ email, password }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const result = await parseResponse(response);
    return result.data;
  },

  register: async ({ name, email, password }) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const result = await parseResponse(response);
    return result.data;
  },

  getMatches: async (token) => {
    const response = await fetch(`${API_BASE_URL}/matches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const result = await parseResponse(response);
    return result.data;
  },

  request: async (path, token, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    return parseResponse(response);
  },

  getTeams: async (token) => {
    const result = await api.request('/teams', token);
    return result.data;
  },

  getTournaments: async (token) => {
    const result = await api.request('/tournaments', token);
    return result.data;
  },

  getPlayers: async (token) => {
    const result = await api.request('/players', token);
    return result.data;
  },

  getMyPlayerProfile: async (token) => {
    const result = await api.request('/players/me', token);
    return result.data;
  },

  checkUsernameAvailability: async (token, username) => {
    const query = encodeURIComponent(username);
    const result = await api.request(`/players/username-availability?username=${query}`, token);
    return result.data;
  },

  saveMyPlayerProfile: async (token, profile) => {
    const result = await api.request('/players/me', token, {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
    return result.data;
  },

  getUsers: async (token) => {
    const result = await api.request('/auth/users', token);
    return result.data;
  },

  createTeam: async (token, team) => {
    const result = await api.request('/teams', token, {
      method: 'POST',
      body: JSON.stringify(team)
    });
    return result.data;
  },

  createPlayer: async (token, player) => {
    const result = await api.request('/players', token, {
      method: 'POST',
      body: JSON.stringify(player)
    });
    return result.data;
  },

  updatePlayer: async (token, playerId, updates) => {
    const result = await api.request(`/players/${playerId}`, token, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return result.data;
  },

  createTournament: async (token, tournament) => {
    const result = await api.request('/tournaments', token, {
      method: 'POST',
      body: JSON.stringify(tournament)
    });
    return result.data;
  },

  registerTeam: async (token, tournamentId, teamId) => {
    const result = await api.request(`/tournaments/${tournamentId}/register`, token, {
      method: 'POST',
      body: JSON.stringify({ teamId })
    });
    return result.data;
  },

  registerForTournament: async (
    token,
    tournamentId,
    allowDifferentSport = false,
    teamId = null,
    lineup = {}
  ) => {
    const result = await api.request(`/tournaments/${tournamentId}/players/register`, token, {
      method: 'POST',
      body: JSON.stringify({ allowDifferentSport, teamId, lineup })
    });
    return result.data;
  },

  createMatch: async (token, match) => {
    const result = await api.request('/matches', token, {
      method: 'POST',
      body: JSON.stringify(match)
    });
    return result.data;
  },

  updateUserRole: async (token, userId, role) => {
    const result = await api.request(`/auth/users/${userId}/role`, token, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
    return result.data;
  }
};
