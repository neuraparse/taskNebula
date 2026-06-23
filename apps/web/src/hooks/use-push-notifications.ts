'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@/lib/hooks/use-organization';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const HAS_VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.length > 0;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const t = useTranslations('hookErrors.pushNotifications');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { currentOrganizationId } = useOrganization();

  useEffect(() => {
    // Check if push notifications are supported
    const supported =
      HAS_VAPID_PUBLIC_KEY &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [currentOrganizationId]);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }

  async function subscribe() {
    if (!isSupported || !currentOrganizationId) {
      return;
    }

    setIsLoading(true);

    try {
      if (!HAS_VAPID_PUBLIC_KEY) {
        throw new Error(t('notConfigured'));
      }

      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error(t('permissionDenied'));
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const response = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: currentOrganizationId,
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
          },
          userAgent: navigator.userAgent,
          deviceName: t(getDeviceNameKey()),
        }),
      });

      if (!response.ok) {
        throw new Error(t('saveSubscription'));
      }

      setIsSubscribed(true);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    if (!isSupported) {
      return;
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from server
        await fetch(
          `/api/push-subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          {
            method: 'DELETE',
          }
        );

        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    isConfigured: HAS_VAPID_PUBLIC_KEY,
    subscribe,
    unsubscribe,
  };
}

function getDeviceNameKey(): 'device.mobile' | 'device.tablet' | 'device.desktop' {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) {
    return 'device.mobile';
  } else if (/tablet/i.test(ua)) {
    return 'device.tablet';
  } else {
    return 'device.desktop';
  }
}
