// Privacy-conscious analytics hook. Events are named and typed here but go nowhere
// by default: no cookies, no identifiers, no third-party script. Wire `sink` to a
// self-hosted, cookieless counter later if wanted.
export type AnalyticsEvent =
  | 'portfolio_entered' | 'quick_portfolio_opened' | 'world_entered' | 'project_viewed'
  | 'game_played' | 'github_clicked' | 'demo_clicked' | 'resume_opened' | 'contact_clicked' | 'easter_egg';

let sink: ((event: AnalyticsEvent, data?: Record<string, string>) => void) | null = null;

export function setAnalyticsSink(fn: typeof sink) {
  sink = fn;
}

export function track(event: AnalyticsEvent, data?: Record<string, string>) {
  if (import.meta.env.DEV) console.debug('[track]', event, data ?? '');
  sink?.(event, data);
}
