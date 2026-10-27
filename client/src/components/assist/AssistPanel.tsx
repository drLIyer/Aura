import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Mic, MicOff, Phone, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { nowLocalDateTime } from "@/lib/dates";
import { apiJson } from "@/lib/queryClient";
import { useSpeech } from "@/lib/speech";
import type { Medication, ProfileRecord } from "@/lib/types";
import { SUGGESTED_QUESTIONS } from "@shared/assist/ask";
import type { Answer, AttackDraft, CaptureProposal, SafetyScreen } from "@shared/assist/types";
import AnswerView from "./AnswerView";
import CaptureCard from "./CaptureCard";

type Tab = "log" | "ask";

function UrgentPanel({ screen }: { screen: SafetyScreen }) {
  if (!screen.urgent) return null;
  return (
    <div role="alert" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 space-y-3" data-testid="assist-urgent">
      <p className="font-semibold text-destructive">Get emergency care now</p>
      <p className="text-sm">{screen.message}</p>
      <Button asChild variant="destructive" className="w-full">
        <a href="tel:911">
          <Phone className="w-4 h-4 mr-2" /> Call 911
        </a>
      </Button>
      <p className="text-xs text-muted-foreground">Outside the US, call your local emergency number. You can save this to your log afterwards.</p>
    </div>
  );
}

function Composer({ placeholder, busy, onSend, testId }: { placeholder: string; busy: boolean; onSend: (text: string) => void; testId: string }) {
  const [text, setText] = useState("");
  const speech = useSpeech((t, final) => {
    setText(t);
    if (final && t) onSend(t);
  });
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        data-testid={`${testId}-input`}
      />
      <div className="flex items-center justify-between gap-2">
        {speech.supported ? (
          <Button type="button" variant={speech.listening ? "destructive" : "outline"} size="sm" onClick={speech.listening ? speech.stop : speech.start} data-testid={`${testId}-mic`}>
            {speech.listening ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
            {speech.listening ? "Stop" : "Speak"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Tip: use your keyboard's mic key to dictate.</span>
        )}
        <Button size="sm" onClick={send} disabled={busy || !text.trim()} data-testid={`${testId}-send`}>
          <Send className="w-4 h-4 mr-1" /> {busy ? "Working…" : "Send"}
        </Button>
      </div>
      {speech.error && <p className="text-xs text-destructive">{speech.error}</p>}
    </div>
  );
}

interface Props {
  onEditInForm: (draft: AttackDraft) => void;
  /** Lets other screens open the panel on a tab. */
  openTab?: Tab | null;
  onOpenHandled?: () => void;
}

export default function AssistPanel({ onEditInForm, openTab, onOpenHandled }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("log");
  const [said, setSaid] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CaptureProposal | null>(null);
  const [saved, setSaved] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: Answer & { screen?: SafetyScreen } }[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery<{ ai: boolean }>({ queryKey: ["/api/assist/status"], enabled: open });
  const { data: medications = [] } = useQuery<Medication[]>({ queryKey: ["/api/medications"], enabled: open });
  const { data: profile } = useQuery<ProfileRecord>({ queryKey: ["/api/profile"], enabled: open });

  useEffect(() => {
    if (openTab) {
      setTab(openTab);
      setOpen(true);
      onOpenHandled?.();
    }
  }, [openTab, onOpenHandled]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [thread, proposal]);

  const capture = useMutation({
    mutationFn: (text: string) => apiJson<CaptureProposal>("/api/assist/capture", "POST", { text, now: nowLocalDateTime() }),
    onMutate: (text) => {
      setSaid(text);
      setSaved(false);
      setProposal(null);
    },
    onSuccess: setProposal,
  });
  const ask = useMutation({
    mutationFn: (question: string) => apiJson<Answer & { screen?: SafetyScreen }>("/api/assist/ask", "POST", { question }),
    onSuccess: (a, q) => setThread((t) => [...t, { q, a }]),
  });

  const suggestions = thread.length ? thread[thread.length - 1].a.suggestions : SUGGESTED_QUESTIONS.slice(0, 5);
  const notice = proposal?.notice ?? thread[thread.length - 1]?.a.notice;

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-40 h-12 rounded-full shadow-lg print:hidden"
        onClick={() => setOpen(true)}
        data-testid="button-talk-to-aura"
        aria-label="Talk to Aura"
      >
        <MessageCircle className="w-5 h-5 mr-2" /> Talk to Aura
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-4 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Talk to Aura</SheetTitle>
            <SheetDescription>Tell Aura what happened, or ask about your patterns. Nothing is saved until you tap Save.</SheetDescription>
          </SheetHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="log" data-testid="tab-assist-log">
                Log it
              </TabsTrigger>
              <TabsTrigger value="ask" data-testid="tab-assist-ask">
                Ask
              </TabsTrigger>
            </TabsList>

            <TabsContent value="log" className="space-y-4 mt-4">
              {said && <p className="rounded-lg bg-primary/10 p-3 text-sm ml-8">{said}</p>}
              {capture.isError && <p className="text-sm text-destructive">Couldn't read that: {(capture.error as Error).message}</p>}
              {proposal && <UrgentPanel screen={proposal.screen} />}
              {saved && <p className="text-sm text-primary font-medium">Saved. Anything else?</p>}
              {proposal && !saved && (
                <CaptureCard
                  key={said ?? ""}
                  proposal={proposal}
                  medications={medications}
                  customTriggers={profile?.patterns.customTriggers ?? []}
                  onSaved={() => setSaved(true)}
                  onEditInForm={(d) => {
                    setOpen(false);
                    onEditInForm(d);
                  }}
                  onDiscard={() => (setProposal(null), setSaid(null))}
                />
              )}
              <Composer
                placeholder="e.g. Migraine since 2, right side, took my sumatriptan at 2:30. Late lunch and slept badly."
                busy={capture.isPending}
                onSend={(t) => capture.mutate(t)}
                testId="assist-log"
              />
            </TabsContent>

            <TabsContent value="ask" className="space-y-4 mt-4">
              {thread.map(({ q, a }, i) => (
                <div key={i} className="space-y-2">
                  <p className="rounded-lg bg-primary/10 p-3 text-sm ml-8">{q}</p>
                  {a.screen && <UrgentPanel screen={a.screen} />}
                  <div className="rounded-lg border border-border p-3" data-testid="assist-answer">
                    <AnswerView blocks={a.blocks} />
                  </div>
                </div>
              ))}
              {ask.isError && <p className="text-sm text-destructive">Couldn't answer: {(ask.error as Error).message}</p>}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <Button key={s} variant="outline" size="sm" className="h-auto py-1 text-xs" onClick={() => ask.mutate(s)} disabled={ask.isPending}>
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              <Composer placeholder="Ask about your migraines, e.g. What are my top triggers?" busy={ask.isPending} onSend={(t) => ask.mutate(t)} testId="assist-ask" />
            </TabsContent>
          </Tabs>
          <div ref={bottom} />

          <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1" data-testid="assist-mode">
            {status?.ai ? (
              <p>
                <Sparkles className="inline w-3 h-3 mr-1" />
                AI mode: answers come only from your records and Aura's guidelines, with sources.
              </p>
            ) : (
              <p>
                Basic mode: AI features aren't turned on, so Aura uses fixed rules. Whoever runs Aura can turn them on (see “Turning on the AI features” in the README).
              </p>
            )}
            {notice && <p>{notice}</p>}
            <p>Aura is not a doctor. For an emergency, call 911 or your local emergency number.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
