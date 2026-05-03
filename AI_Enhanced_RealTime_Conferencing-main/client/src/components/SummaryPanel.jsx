import React from 'react';
export default function SummaryPanel({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ padding:8, borderTop:'1px solid #ccc' }}>
      <h4>Meeting Summary</h4>
      <p>{summary.summary}</p>
      {summary.actionItems?.length>0 && <div><b>Action Items:</b><ul>{summary.actionItems.map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
      {summary.decisions?.length>0 && <div><b>Decisions:</b><ul>{summary.decisions.map((d,i)=><li key={i}>{d}</li>)}</ul></div>}
    </div>
  );
}
