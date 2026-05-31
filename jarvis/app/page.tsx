// app/page.tsx
import { JarvisCanvas } from "@/components/jarvis/JarvisCanvas";
import { VoiceController } from "@/components/VoiceController";

export default function Page() {
  return (
    <main>
      <JarvisCanvas />
      <VoiceController />
    </main>
  );
}
