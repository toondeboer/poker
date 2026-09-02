// src/hooks/useNotificationPermission.ts
import { logger } from '@/src/utils/logger';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { liveActivityService } from '@/src/services/LiveActivityService';

export function useNotificationPermission() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    /**
     * @returns what the OS actually said, as well as storing it.
     *
     * Returned because a caller that has just requested the permission needs
     * to know whether it worked, and `requestPermission`'s own return value
     * answers a different question — it is `true` unconditionally below API 33
     * and on paths it does not handle.
     */
    const checkPermission = async (): Promise<boolean> => {
        setIsLoading(true);
        try {
            if (Platform.OS === 'android') {
                const hasNotificationPermission = await liveActivityService.hasNotificationPermission();
                setHasPermission(hasNotificationPermission);
                return hasNotificationPermission;
            }
            // iOS handles Live Activity permissions automatically
            setHasPermission(true);
            return true;
        } catch (error) {
            logger.error('Error checking notification permission:', error);
            setHasPermission(false);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            try {
                // No `rationale` argument, deliberately: passing one makes
                // React Native show *its own* Alert before the system sheet
                // whenever `shouldShowRequestPermissionRationale` is true —
                // which it is on every launch after the first denial. That's
                // the "Android asks twice" report. The permission also needs no
                // explaining: this is a timer whose whole job is to notify you.
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                );

                const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
                if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
                    // Android blocks the permission permanently after a second
                    // denial: every later `request` returns this immediately,
                    // without showing anything. The foreground service then
                    // refuses to start, so the background timer and its expiry
                    // alarm are silently dead. Logged distinctly because it is
                    // the state `NotificationsBlockedCard` in Settings exists
                    // for: that card is the in-app route back, and it reaches
                    // system settings through `showPermissionAlert` below.
                    // **`showPermissionAlert` is not dead code** — it has a
                    // caller now, and it is the only path to `openSettings`.
                    logger.warn(
                        'POST_NOTIFICATIONS is permanently denied; background timer notifications cannot start until it is re-enabled in system settings',
                    );
                }
                setHasPermission(hasPermission);
                return hasPermission;
            } catch (error) {
                logger.error('Error requesting notification permission:', error);
                setHasPermission(false);
                return false;
            }
        }

        // For iOS or older Android versions
        setHasPermission(true);
        return true;
    };

    const showPermissionAlert = () => {
        Alert.alert(
            'Notification Permission Required',
            'To show timer updates in the background, please enable notifications in your device settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'android') {
                            Linking.openSettings();
                        } else {
                            Linking.openURL('app-settings:');
                        }
                    }
                },
            ]
        );
    };

    useEffect(() => {
        // Async permission check on mount; the setState calls inside run after
        // awaits / are the result of the async work, so this is intentional.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkPermission();
    }, []);

    return {
        hasPermission,
        isLoading,
        requestPermission,
        showPermissionAlert,
        checkPermission,
    };
}


