// src/hooks/useNotificationPermission.ts
import { logger } from '@/src/utils/logger';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { liveActivityService } from '@/src/services/LiveActivityService';

export function useNotificationPermission() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkPermission = async () => {
        setIsLoading(true);
        try {
            if (Platform.OS === 'android') {
                const hasNotificationPermission = await liveActivityService.hasNotificationPermission();
                setHasPermission(hasNotificationPermission);
            } else {
                // iOS handles Live Activity permissions automatically
                setHasPermission(true);
            }
        } catch (error) {
            logger.error('Error checking notification permission:', error);
            setHasPermission(false);
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
                    // alarm are silently dead. Logged distinctly because
                    // there is currently no in-app route back — the user has to
                    // find it in system settings (see ROADMAP.md).
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


