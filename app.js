/* ============================================================
   ADDITIONS — polished To Pay split, colored buy chips, pins
   ============================================================ */

/* Polished To Pay split rows (Option 1) */
.sec-lbl{
  font-size:11px;font-weight:700;color:var(--text2);
  text-transform:uppercase;letter-spacing:.6px;
  margin:18px 4px 10px;
}
.pay-row{
  display:flex;align-items:center;gap:14px;
  background:var(--card);border-radius:16px;
  padding:14px 16px;margin-bottom:8px;
}
.pay-row .av{width:38px;height:38px;font-size:15px;flex-shrink:0;}
.pay-row .who{
  flex:1;min-width:0;
  font-size:15px;font-weight:600;letter-spacing:-.2px;
  color:var(--text);
}
.pay-row .amt-wrap{
  display:flex;align-items:baseline;gap:2px;flex-shrink:0;
}
.pay-row input.amt{
  width:80px;text-align:right;
  font-size:16px;font-weight:600;letter-spacing:-.3px;
  font-family:inherit;background:transparent;border:none;outline:none;
  color:var(--text);padding:0;
  font-variant-numeric:tabular-nums;
}
.pay-row .cur{
  font-size:11px;font-weight:600;color:var(--text2);letter-spacing:0;
}
.pay-row .check{
  width:24px;height:24px;border-radius:12px;
  border:1.5px solid var(--track);
  display:flex;align-items:center;justify-content:center;
  color:transparent;font-weight:800;font-size:12px;
  cursor:pointer;flex-shrink:0;transition:all .15s;
}
.pay-row .check.on{
  background:var(--green);border-color:var(--green);color:#fff;
}
.pay-row.off{opacity:.45;}
.pay-row.off input.amt{color:var(--text3);}
.total-row{
  display:flex;justify-content:space-between;align-items:baseline;
  padding:12px 6px 4px;
  font-size:12px;font-weight:600;color:var(--text2);
  letter-spacing:-.1px;
}
.total-row .amt-val{
  font-size:15px;font-weight:700;color:var(--text);
  letter-spacing:-.3px;
  font-variant-numeric:tabular-nums;
}
.total-row .amt-val .cur{
  font-size:10px;color:var(--text2);font-weight:600;margin-left:2px;
}
.total-row.warn .amt-val{color:var(--red);}

/* Buy chips — all 50 palette colors work via --cat */
.buy-chip{
  padding:9px 15px;border-radius:20px;font-size:13px;font-weight:600;
  letter-spacing:-.1px;cursor:pointer;display:flex;align-items:center;
  gap:6px;white-space:nowrap;
  background:color-mix(in srgb, var(--cat, var(--blue)) 15%, var(--card));
  color:var(--cat, var(--blue));
}
.buy-chip.active{font-weight:700;}

/* Pin over-budget state */
.pin.over{
  background:color-mix(in srgb, var(--red) 12%, var(--card));
  border-color:color-mix(in srgb, var(--red) 22%, transparent);
}
.pin.over .v{color:var(--red);}
.pin.over .bar-in>div{background:var(--red);}
.pin.over .bar-pct{color:var(--red);}

/* Pin pill (shown in Settings → Appearance) */
.pill-pin{
  font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px;
  letter-spacing:.4px;text-transform:uppercase;margin-left:4px;vertical-align:middle;
  background:var(--pill-pin-bg);color:var(--pill-pin-cl);
}