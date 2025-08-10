declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        close(): void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          chat_instance?: string;
          chat_type?: string;
          start_param?: string;
        };
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color: string;
          text_color: string;
          hint_color: string;
          link_color: string;
          button_color: string;
          button_text_color: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        onEvent(eventType: string, eventHandler: () => void): void;
        offEvent(eventType: string, eventHandler: () => void): void;
        showAlert(message: string): void;
        showConfirm(message: string, callback: (confirmed: boolean) => void): void;
        showPopup(params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text: string;
          }>;
        }, callback?: (buttonId: string) => void): void;
        switchInlineQuery(query: string, chatTypes?: string[]): void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          readonly isProgressVisible: boolean;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setText(text: string): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
        };
        BackButton: {
          isVisible: boolean;
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
        };
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class TelegramWebApp {
  private static instance: TelegramWebApp;
  public webApp: any = null;

  private constructor() {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      this.webApp = window.Telegram.WebApp;
      this.init();
      
      // Логируем информацию о WebApp для отладки
      console.log('TelegramWebApp initialized:',
        this.isAvailable() ? 'Available' : 'Not available',
        'User:', this.getUser()?.id || 'No user',
        'InitData length:', this.getInitData()?.length || 0
      );
    } else {
      console.log('TelegramWebApp not available');
    }
  }

  static getInstance(): TelegramWebApp {
    if (!TelegramWebApp.instance) {
      TelegramWebApp.instance = new TelegramWebApp();
    }
    return TelegramWebApp.instance;
  }

  private init() {
    if (this.webApp) {
      try {
        this.webApp.ready();
        this.webApp.expand();
      } catch (e) {
        console.error('Error initializing Telegram WebApp:', e);
      }
    }
  }

  isAvailable(): boolean {
    return this.webApp !== null;
  }

  getUser(): TelegramUser | null {
    try {
      if (this.webApp?.initDataUnsafe?.user) {
        return this.webApp.initDataUnsafe.user;
      }
    } catch (e) {
      console.error('Error getting Telegram user:', e);
    }
    return null;
  }

  getInitData(): string | null {
    try {
      return this.webApp?.initData || null;
    } catch (e) {
      console.error('Error getting Telegram initData:', e);
      return null;
    }
  }

  getStartParam(): string | null {
    return this.webApp?.initDataUnsafe?.start_param || null;
  }

  getColorScheme(): 'light' | 'dark' {
    return this.webApp?.colorScheme || 'dark';
  }

  showAlert(message: string) {
    if (this.webApp) {
      this.webApp.showAlert(message);
    } else {
      alert(message);
    }
  }

  showConfirm(message: string, callback: (confirmed: boolean) => void) {
    if (this.webApp) {
      this.webApp.showConfirm(message, callback);
    } else {
      const confirmed = confirm(message);
      callback(confirmed);
    }
  }

  hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light') {
    if (this.webApp?.HapticFeedback) {
      if (type === 'success' || type === 'error' || type === 'warning') {
        this.webApp.HapticFeedback.notificationOccurred(type);
      } else {
        this.webApp.HapticFeedback.impactOccurred(type);
      }
    }
  }

  close() {
    if (this.webApp) {
      this.webApp.close();
    } else {
      window.close();
    }
  }

  switchInlineQuery(query: string, chatTypes?: string[]) {
    if (this.webApp) {
      this.webApp.switchInlineQuery(query, chatTypes);
    }
  }
}

export const telegramWebApp = TelegramWebApp.getInstance();