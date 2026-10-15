// Journey world screens, drawn in the DOM over the canvas: the NPC dialogue box
// (ASK A QUESTION) and the memory journal for each chapter building. Loaded as
// part of the Journey chunk, only while that world is open.
import { useEffect, useMemo, useRef, useState } from 'react';
import { achievements, dialogue, education, experience, journey, type JourneyStop } from '../../../content';
import { audio } from '../../../engine/audio/AudioManager';
import { clearInput } from '../../../engine/input/input';
import { useGame } from '../../../stores/gameStore';
import { useSettings } from '../../../stores/settingsStore';
import { GOODBYE, menuFor, moveSelection, visibleChars, type Choice } from '../dialogue';
import { useJourney } from '../journeyStore';
import { HUMAN_H, HUMAN_W, LOOKS, humanAtlas, type HumanLook } from '../sprites/pixelArt';

export default function JourneyOverlay() {
  const overlay = useGame((s) => s.overlay);
  if (overlay === 'dialogue') return <DialogueBox />;
  if (overlay === 'journal') return <Journal />;
  return null;
}

function close() {
  clearInput();
  useGame.getState().closeOverlay();
  useJourney.setState({ talking: null, stop: null });
}

function Portrait({ look }: { look: HumanLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const atlas = humanAtlas(look);
    const c = ref.current;
    if (!c) return;
    const img = new ImageData(HUMAN_W, HUMAN_H);
    for (let y = 0; y < HUMAN_H; y++) {
      for (let x = 0; x < HUMAN_W; x++) {
        const si = (y * atlas.width + x) * 4;
        img.data.set(atlas.data.subarray(si, si + 4), (y * HUMAN_W + x) * 4);
      }
    }
    c.getContext('2d')!.putImageData(img, 0, 0);
  }, [look]);
  return <canvas ref={ref} className="dlg-portrait" width={HUMAN_W} height={HUMAN_H} aria-hidden="true" />;
}

type Mode = 'say' | 'menu';

/**
 * Conversation box. A line (greeting or answer) types out and then stays on screen
 * until the visitor presses E / Enter / Space or clicks Continue; only then does
 * the question menu come back. Picking a question shows its answer the same way.
 */
function DialogueBox() {
  const id = useJourney((s) => s.talking) ?? 'jose';
  const npc = journey.npcs.find((n) => n.id === id) ?? journey.npcs[0];
  const look = LOOKS[id as keyof typeof LOOKS] ?? LOOKS.jose;
  const hasQuestions = id === 'jose';
  const reduced = useSettings((s) => s.reducedMotion);
  const asked = useJourney((s) => s.asked);
  const [mode, setMode] = useState<Mode>('say');
  const [text, setText] = useState(npc.greeting ?? '');
  const [question, setQuestion] = useState<string | null>(null);
  const [shown, setShown] = useState(reduced ? Infinity : 0);
  const [sel, setSel] = useState(0);
  const started = useRef(performance.now());
  const choices = useMemo(() => menuFor(dialogue, asked), [asked]);
  const typing = mode === 'say' && shown < text.length;
  const list = useRef<HTMLUListElement>(null);

  // Typewriter for the current line.
  useEffect(() => {
    if (mode !== 'say') return;
    if (reduced) {
      setShown(Infinity);
      return;
    }
    started.current = performance.now();
    let id = 0;
    let last = 0;
    const tick = () => {
      const n = visibleChars(text, (performance.now() - started.current) / 1000);
      if (n !== last) {
        if (Math.floor(n / 3) !== Math.floor(last / 3)) audio.play('talk');
        last = n;
        setShown(n);
      }
      if (n < text.length) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [text, mode, reduced]);

  const say = (line: string) => {
    setShown(reduced ? Infinity : 0);
    setText(line);
    setMode('say');
  };

  // Finish the line at once (the typewriter loop then sees it as complete).
  const skip = () => {
    started.current = -1e9;
    setShown(Infinity);
  };

  const proceed = () => {
    if (!hasQuestions) return close();
    audio.play('ui');
    setMode('menu');
  };

  const choose = (c: Choice) => {
    if (c.id === GOODBYE) return close();
    audio.play('select');
    setQuestion(c.label);
    say(c.answer ?? '');
    if (!asked.includes(c.id)) {
      const next = [...asked, c.id];
      useJourney.setState({ asked: next });
      useGame.setState((s) => ({ dialogueProgress: { ...s.dialogueProgress, jose: next.length } }));
      if (next.length === dialogue.length) useGame.getState().completeInteraction('journey:all-questions');
    }
    // When the menu comes back, the cursor waits on the next question not asked yet.
    const i = choices.indexOf(c);
    const after = choices.findIndex((x, j) => j > i && !x.asked && x.id !== c.id);
    setSel(after >= 0 ? after : choices.length - 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyS', 'Enter'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      const confirm = k === 'Enter' || k === 'KeyE' || k === 'Space';
      if (mode === 'say') {
        if (confirm) {
          if (typing) skip();
          else proceed();
        }
        return;
      }
      if (confirm) choose(choices[sel]);
      else if (k === 'ArrowUp' || k === 'KeyW') setSel((i) => moveSelection(i, -1, choices.length));
      else if (k === 'ArrowDown' || k === 'KeyS') setSel((i) => moveSelection(i, 1, choices.length));
      else if (/^Digit[1-9]$/.test(k)) {
        const c = choices[Number(k.slice(5)) - 1];
        if (c) choose(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (mode === 'menu') (list.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [sel, mode]);

  // Buttons never take focus, so a key press is only ever handled once (above).
  const noFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="dlg-wrap" role="dialog" aria-modal="true" aria-label={`Talking with ${npc.name}`}>
      <section className="dlg">
        <Portrait look={look} />
        <div className="dlg-main">
          <div className="dlg-name">{npc.name}</div>
          {mode === 'say' ? (
            <>
              {question && <div className="dlg-question">“{question}”</div>}
              <p className="dlg-text" aria-live="polite">
                {text.slice(0, shown)}
                {typing && <span className="dlg-caret" aria-hidden="true">▌</span>}
              </p>
              {!typing && (
                <button className="dlg-continue" tabIndex={-1} onMouseDown={noFocus} onClick={proceed}>
                  {hasQuestions ? 'Continue' : 'Goodbye'} <span aria-hidden="true">▼</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="dlg-kicker">ASK A QUESTION</div>
              <ul ref={list} className="dlg-choices" role="listbox" aria-label="Questions">
                {choices.map((c, i) => (
                  <li key={c.id} role="option" aria-selected={i === sel}>
                    <button
                      className={`dlg-choice ${i === sel ? 'sel' : ''} ${c.asked ? 'asked' : ''}`}
                      tabIndex={-1}
                      onMouseDown={noFocus}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => choose(c)}
                    >
                      <span className="dlg-cursor" aria-hidden="true">{i === sel ? '▶' : ''}</span>
                      {i < 9 && <kbd>{i + 1}</kbd>}
                      {c.label}
                      {c.asked && <span className="dlg-check" aria-label="asked"> ✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="dlg-help">
            {mode === 'menu'
              ? '↑ ↓: choose · E / Enter: ask · Esc: leave'
              : typing
                ? 'E / Enter: show the whole line'
                : `E / Enter: ${hasQuestions ? 'back to the questions' : 'goodbye'} · Esc: leave`}
          </div>
        </div>
      </section>
    </div>
  );
}

function Journal() {
  const id = useJourney((s) => s.stop);
  const stops = journey.stops;
  const index = Math.max(0, stops.findIndex((s) => s.id === id));
  const stop = stops[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = (d: number) => {
    const next = stops[index + d];
    if (!next) return;
    audio.play('page');
    useJourney.setState({ stop: next.id });
  };

  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') go(-1);
      if (e.code === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!stop) return null;
  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="inspector journal memory" role="dialog" aria-modal="true" aria-labelledby="memory-title">
        <header>
          <div className="kicker">
            ❖ MEMORY · CHAPTER {index + 1} OF {stops.length} · {stop.year}
          </div>
          <h2 id="memory-title">{stop.label}</h2>
          <button ref={closeRef} className="icon-btn" onClick={close} aria-label="Close memory">
            ✕
          </button>
        </header>
        <div className="inspector-body">
          <MemoryBody stop={stop} />
        </div>
        <footer className="memory-footer">
          <button className="btn" onClick={() => go(-1)} disabled={index === 0}>
            ← Earlier
          </button>
          <button className="btn" onClick={() => go(1)} disabled={index === stops.length - 1}>
            Later →
          </button>
          <span className="memory-spacer" />
          <button className="btn" onClick={() => useGame.getState().openOverlay('quick', 'experience')}>
            Full résumé
          </button>
          <button className="btn" onClick={close}>
            Close <kbd>Esc</kbd>
          </button>
        </footer>
      </section>
    </div>
  );
}

function MemoryBody({ stop }: { stop: JourneyStop }) {
  const eds = (stop.education ?? []).map((id) => education.find((e) => e.id === id)).filter((e) => !!e);
  const jobs = (stop.experience ?? []).map((id) => experience.find((e) => e.id === id)).filter((e) => !!e);
  const certs = stop.certificationsFrom ? achievements.filter((a) => a.from === stop.certificationsFrom) : [];
  return (
    <div className="memory-body">
      <p className="memory-story">{stop.story}</p>
      {eds.map((e) => (
        <article key={e.id} className="memory-entry">
          <h3>{e.institution}</h3>
          <div className="memory-when">{e.when}</div>
          <p>{e.credential}</p>
        </article>
      ))}
      {jobs.map((j) => (
        <article key={j.id} className="memory-entry">
          <h3>
            {j.role} <span className="memory-org">· {j.org}</span>
          </h3>
          <div className="memory-when">{j.when}</div>
          <p>{j.summary}</p>
          {!!j.highlights?.length && (
            <ul>
              {j.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          {!!j.technologies.length && (
            <div className="chips">
              {j.technologies.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          )}
        </article>
      ))}
      {!!certs.length && (
        <article className="memory-entry">
          <h3>Certifications</h3>
          <ul>
            {certs.map((c) => (
              <li key={c.title}>
                {c.title} <span className="memory-when">({c.when})</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}
