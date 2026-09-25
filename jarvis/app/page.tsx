// app/page.tsx
import { JarvisCanvas } from "@/components/jarvis/JarvisCanvas";
import { VoiceController } from "@/components/VoiceController";

export default function Page() {
  return (
    <main>
      <JarvisCanvas />
      <VoiceController />
      {/* cityzen.kr로 돌아가기 — 전체화면 오브 위의 작은 고정 알약 */}
      <a className="pol-back-btn jv-home" href="https://cityzen.kr">← cityzen</a>
    </main>
  );
}
