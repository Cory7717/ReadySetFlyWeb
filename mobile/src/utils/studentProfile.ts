import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from './auth';

export type StudentProfileData = {
  wizardJson?: Record<string, any> | null;
  roadmapJson?: Record<string, any> | null;
  progressJson?: Record<string, any> | null;
};

const LOCAL_KEY = 'rsf.studentProfile';

async function readLocalProfile(): Promise<StudentProfileData> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeLocalProfile(profile: StudentProfileData) {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
  } catch {}
}

export function useStudentProfile() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const [localProfile, setLocalProfile] = useState<StudentProfileData>({});

  const { data: serverProfile, isLoading } = useQuery<StudentProfileData>({
    queryKey: ['/api/student/profile'],
    enabled: !!user,
    queryFn: async () => {
      const res = await api.get('/api/student/profile');
      return res.data;
    },
  });

  useEffect(() => {
    if (!user) {
      readLocalProfile().then(setLocalProfile).catch(() => setLocalProfile({}));
    }
  }, [user?.id]);

  const profile = useMemo(() => {
    return user ? (serverProfile || {}) : localProfile;
  }, [user, serverProfile, localProfile]);

  const saveMutation = useMutation({
    mutationFn: async (updates: StudentProfileData) => {
      const payload = {
        wizardJson: updates.wizardJson ?? null,
        roadmapJson: updates.roadmapJson ?? null,
        progressJson: updates.progressJson ?? null,
      };
      const res = await api.put('/api/student/profile', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/student/profile'] });
    },
  });

  const saveProfile = (updates: StudentProfileData) => {
    if (user) {
      saveMutation.mutate(updates);
      return;
    }
    const next = { ...localProfile, ...updates };
    setLocalProfile(next);
    void writeLocalProfile(next);
  };

  return {
    profile,
    saveProfile,
    isLoading: user ? isLoading : false,
    saving: saveMutation.isPending,
  };
}
