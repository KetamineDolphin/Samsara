import T from './tokens';

/* Typography rules:
 *   T.fd  = Cormorant Garamond (display — page titles, hero numbers)
 *   T.fb  = Inter             (UI text — labels, buttons, metadata, body)
 *   T.fm  = DM Mono           (numeric data — doses, weights, timestamps)
 * Golden-ratio spacing: 4, 8, 13, 21, 34, 55
 */

const S = {
  root: { minHeight: '100vh', background: T.bg, color: T.t1, fontFamily: T.fb, maxWidth: 480, margin: '0 auto', position: 'relative', overflow: 'hidden' },
  bgGlow: { position: 'fixed', top: -120, left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle,rgba(201,168,76,0.03) 0%,transparent 70%)', zIndex: 0 },
  content: { position: 'relative', zIndex: 1, padding: '13px 13px 90px', overflowY: 'auto', height: '100vh' },

  /* Page headers */
  header: { textAlign: 'center', marginBottom: 21 },
  brand: { fontFamily: T.fd, fontSize: 26, fontWeight: 300, letterSpacing: 8, color: T.t1, margin: 0, marginTop: -4 },
  sub: { fontFamily: T.fb, fontSize: 11, letterSpacing: 2.5, fontWeight: 500, color: T.t3, textTransform: 'uppercase', marginTop: 4 },

  /* Pills — filter / preset selectors */
  pills: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 21 },
  pill: { background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 21, padding: '8px 14px', fontSize: 13, color: T.t2, cursor: 'pointer', fontFamily: T.fb, fontWeight: 500, letterSpacing: 0.2, transition: 'all .15s ease' },
  pillOn: { background: T.goldS, borderColor: T.goldM, color: T.gold },

  /* Cards — unified soft surface with no colored stripes */
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 14px', marginBottom: 13, transition: 'all .15s ease' },

  /* Inputs — subtle fill, no heavy inner shadow */
  field: { marginBottom: 0 },
  label: { display: 'block', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, marginBottom: 8, fontFamily: T.fb, fontWeight: 600 },
  frow: { display: 'flex', alignItems: 'center', gap: 8 },
  input: { flex: 1, background: 'rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '13px 13px', fontSize: 17, fontWeight: 600, color: T.t1, fontFamily: T.fm, outline: 'none', transition: 'border-color .2s', WebkitAppearance: 'none' },
  tag: { background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '13px 13px', fontSize: 12, color: T.t2, fontWeight: 600, fontFamily: T.fb, minWidth: 42, textAlign: 'center' },

  /* Dividers */
  divider: { height: 1, background: T.border, margin: '13px 0' },
  dividerGold: { height: 1, background: `linear-gradient(90deg,transparent,${T.goldM},transparent)`, margin: '13px 0' },

  /* Lock / secondary action buttons (ghost-ish) */
  lockBtn: { background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 13px', fontSize: 12, fontWeight: 500, color: T.t2, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'all .15s ease', whiteSpace: 'nowrap' },
  lockOn: { borderColor: T.goldM, color: T.gold, background: T.goldS },

  /* Segmented toggle group (unit picker, etc.) */
  togGrp: { display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` },
  togBtn: { background: 'rgba(255,255,255,0.02)', border: 'none', padding: '13px 13px', fontSize: 12, fontWeight: 600, color: T.t2, cursor: 'pointer', fontFamily: T.fb, transition: 'all .15s ease' },
  togOn: { background: T.goldS, color: T.gold },

  /* Frequency pill buttons */
  freqBtn: { flex: 1, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 4px', fontSize: 12, fontWeight: 500, color: T.t2, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'all .15s ease', textAlign: 'center' },
  freqOn: { background: T.goldS, borderColor: T.goldM, color: T.gold },

  /* Result/readout cards */
  resultCard: { background: 'rgba(201,168,76,0.025)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 14, padding: '14px 14px', marginBottom: 13 },
  resRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, color: T.t3, fontFamily: T.fb },
  resGold: { fontSize: 14, fontWeight: 700, color: T.gold, fontFamily: T.fm },

  /* Draw (big readout in calc) */
  drawLabel: { display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, color: T.t3, fontFamily: T.fb, marginBottom: 4 },
  drawVal: { display: 'block', fontSize: 40, fontWeight: 300, color: T.t1, fontFamily: T.fd, lineHeight: 1.1 },
  drawUnit: { fontSize: 15, fontWeight: 600, color: T.goldM },
  drawSub: { display: 'block', fontSize: 12, color: T.t3, marginTop: 4, fontFamily: T.fb },

  /* Stats row */
  stats: { display: 'flex', justifyContent: 'space-around', paddingTop: 8 },
  stat: { textAlign: 'center' },
  statV: { display: 'block', fontSize: 17, fontWeight: 700, color: T.t1, fontFamily: T.fm },
  statL: { display: 'block', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600, color: T.t3, marginTop: 4, fontFamily: T.fb },

  /* Inline info boxes */
  warning: { marginTop: 8, padding: '10px 14px', background: T.warn, border: `1px solid ${T.warnB}`, borderRadius: 10, fontSize: 13, color: T.warnT, lineHeight: 1.6, fontFamily: T.fb },
  infoBox: { marginTop: 8, padding: '10px 14px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 10, fontSize: 13, color: 'rgba(201,168,76,0.7)', lineHeight: 1.6, fontFamily: T.fb },

  /* Track (compound row in daily log) */
  trackRow: { display: 'flex', alignItems: 'center', gap: 13, padding: '13px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 8, transition: 'all .15s ease', cursor: 'pointer' },
  trackName: { fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fb, letterSpacing: 0 },
  trackMeta: { fontSize: 12, color: T.t3, marginTop: 4, fontFamily: T.fb, letterSpacing: 0.2, fontWeight: 500 },

  /* Buttons — Primary (filled gold), Secondary (soft), Ghost (text)
     logBtn is the primary CTA used everywhere (Log, Add to Stack, Save) */
  logBtn: { background: T.gold, border: `1px solid ${T.gold}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: T.bg, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'all .15s ease', whiteSpace: 'nowrap' },
  btnSecondary: { background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: T.t1, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'all .15s ease', whiteSpace: 'nowrap' },
  btnGhost: { background: 'transparent', border: 'none', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: T.t2, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'color .15s ease', whiteSpace: 'nowrap' },

  loggedBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },

  /* Vials */
  vialCard: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px', marginBottom: 13 },
  vialHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  vialName: { fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fb },
  vialConc: { fontSize: 13, color: T.gold, fontFamily: T.fm, fontWeight: 600 },
  barTrack: { height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 2, transition: 'width .5s ease' },
  vialStats: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.t3, fontFamily: T.fb, letterSpacing: 0.2, fontWeight: 500, marginBottom: 8 },
  newVialBtn: { width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${T.border}`, borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 500, color: T.t2, cursor: 'pointer', fontFamily: T.fb, letterSpacing: 0.2, transition: 'all .15s ease' },

  /* Log feed */
  logDate: { fontSize: 11, fontWeight: 700, color: T.gold, fontFamily: T.fb, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  logRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6 },
  logName: { flex: 1, fontSize: 14, fontWeight: 500, color: T.t1, fontFamily: T.fb },
  logDose: { fontSize: 13, color: T.t2, fontFamily: T.fm, fontWeight: 500 },
  logTime: { fontSize: 11, color: T.t3, fontFamily: T.fm, minWidth: 52, textAlign: 'right' },

  /* Segmented nav (top tabs inside each page) */
  segWrap: { display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4, marginBottom: 21, border: `1px solid ${T.border}` },
  segBtn: { flex: 1, background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 500, color: T.t3, cursor: 'pointer', fontFamily: T.fb, transition: 'all .15s ease' },
  segOn: { background: T.goldS, color: T.gold, fontWeight: 600 },

  /* Bottom tab bar */
  tabBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(8,9,11,0.88)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderTop: `1px solid ${T.border}`, padding: '8px 0 env(safe-area-inset-bottom, 8px)', zIndex: 100 },
  tabBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 8px', position: 'relative' },
  tabLabel: { fontSize: 10, fontWeight: 500, letterSpacing: 0.8, fontFamily: T.fb, transition: 'color .2s' },
  tabLine: { position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 16, height: 2, borderRadius: 1, background: T.amberFull },
  tabDot: { position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: T.amberFull },

  /* Library stats */
  libStat: { background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 13px' },
  libStatL: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, color: T.t3, fontFamily: T.fb, marginBottom: 4 },
  libStatV: { display: 'block', fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fm },
};

export default S;
