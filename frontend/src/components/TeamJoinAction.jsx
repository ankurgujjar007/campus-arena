const TeamJoinAction = ({ isMember, isCaptain, status, busy, onRequest, onView }) => {
  if (isMember || isCaptain)
    return (
      <div className="team-join-actions">
        <span className="joined-label">{isCaptain ? 'Captain · Your team' : 'Member'}</span>
        <button type="button" className="secondary-button" onClick={onView}>
          View team
        </button>
      </div>
    );
  if (status === 'pending')
    return (
      <span className="team-request-status pending" role="status">
        Request pending
      </span>
    );
  return (
    <div className="team-join-actions">
      {status === 'denied' && <span className="team-request-status denied">Request denied</span>}
      <button type="button" className="secondary-button" disabled={busy} onClick={onRequest}>
        {busy ? 'Sending…' : status === 'denied' ? 'Request again' : 'Request to join'}
      </button>
    </div>
  );
};
export default TeamJoinAction;
