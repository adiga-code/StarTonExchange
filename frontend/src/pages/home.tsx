import TelegramApp from "@/components/telegram-app";
import TelegramGuard from "@/components/telegram-guard";

export default function Home() {
  return (
    <TelegramGuard>
      <TelegramApp />
    </TelegramGuard>
  );
}