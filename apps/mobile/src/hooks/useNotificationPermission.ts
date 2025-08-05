// src/hooks/useNotificationPermission.ts
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
                const hasNotificationPermission = await liveActivityService.requestNotificationPermission();
                setHasPermission(hasNotificationPermission);
            } else {
                // iOS handles Live Activity permissions automatically
                setHasPermission(true);
            }
        } catch (error) {
            console.error('Error checking notification permission:', error);
            setHasPermission(false);
        } finally {
            setIsLoading(false);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                    {
                        title: 'Notification Permission',
                        message: 'This app needs notification permission to show timer updates when running in the background.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );

                const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
                setHasPermission(hasPermission);
                return hasPermission;
            } catch (error) {
                console.error('Error requesting notification permission:', error);
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


