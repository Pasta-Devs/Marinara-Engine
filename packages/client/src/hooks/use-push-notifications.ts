import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PUSH_NOTIFICATION_SETTINGS_KEY,
  type PushNotificationSettings,
  type PushNotificationSettingsUpdate,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const pushNotificationKeys = {
  settings: ["app-settings", PUSH_NOTIFICATION_SETTINGS_KEY] as const,
};

const PATH = `/app-settings/${PUSH_NOTIFICATION_SETTINGS_KEY}`;

export function usePushNotificationSettings() {
  return useQuery<PushNotificationSettings>({
    queryKey: pushNotificationKeys.settings,
    queryFn: () => api.get(PATH),
    staleTime: 5 * 60_000,
    // A 403 (not the owner) will not pass on a retry.
    retry: false,
  });
}

export function useUpdatePushNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: PushNotificationSettingsUpdate) => api.put<PushNotificationSettings>(PATH, changes),
    onSuccess: (settings) => qc.setQueryData(pushNotificationKeys.settings, settings),
  });
}

export function useRotatePushNotificationTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PushNotificationSettings>(`${PATH}/topic`),
    onSuccess: (settings) => qc.setQueryData(pushNotificationKeys.settings, settings),
  });
}

export function useSendTestPushNotification() {
  return useMutation({ mutationFn: () => api.post<{ ok: true }>(`${PATH}/test`) });
}
