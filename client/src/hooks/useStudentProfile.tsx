import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type StudentProfileData = {
  wizardJson?: Record<string, any> | null;
  roadmapJson?: Record<string, any> | null;
  progressJson?: Record<string, any> | null;
};

const LOCAL_KEY = "rsf.studentProfile";

function readLocalProfile(): StudentProfileData {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalProfile(profile: StudentProfileData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
  } catch {}
}

export function useStudentProfile() {
  const { user } = useAuth();
  const [localProfile, setLocalProfile] = useState<StudentProfileData>(() => readLocalProfile());

  const { data: serverProfile, isLoading } = useQuery<StudentProfileData>({
    queryKey: ["/api/student/profile"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      setLocalProfile(readLocalProfile());
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
      const res = await apiRequest("PUT", "/api/student/profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/profile"] });
    },
  });

  const saveProfile = (updates: StudentProfileData) => {
    if (user) {
      return saveMutation.mutate(updates);
    }
    const next = { ...localProfile, ...updates };
    setLocalProfile(next);
    writeLocalProfile(next);
  };

  return {
    profile,
    saveProfile,
    isLoading: user ? isLoading : false,
    saving: saveMutation.isPending,
  };
}
