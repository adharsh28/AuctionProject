import React, { useEffect, useState } from 'react';
import socket from '../socket';

function TeamSquad() {
  const [team, setTeam] = useState([]);
  const playerName = localStorage.getItem('name');

  useEffect(() => {
    socket.emit('get-team', { playerName });

    socket.on('team-data', (teamList) => {
      setTeam(teamList);
    });

    return () => {
      socket.off('team-data');
    };
  }, [playerName]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>{playerName}'s Squad</h2>
      {team.length === 0 ? (
        <p>No players assigned yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {team.map((p, i) => (
            <li key={i} style={{ marginBottom: '20px' }}>
              <img src={p.image} alt={p.name} width="100" />
              <p>{p.name} — {p.team} — Runs: {p.runs}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TeamSquad;