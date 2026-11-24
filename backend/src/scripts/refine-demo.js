require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const rules = require('../../../shared/sportLineups.json');
const catalog = [
  [
    'Basketball',
    'Court Hawks',
    'Campus Wolves',
    8,
    'University Indoor Arena',
    ['Point guard', 'Shooting guard', 'Forward', 'Centre']
  ],
  [
    'Football',
    'Field Falcons',
    'United Lions',
    15,
    'North Campus Football Ground',
    ['Goalkeeper', 'Defender', 'Midfielder', 'Striker']
  ],
  [
    'Cricket',
    'Pavilion XI',
    'Boundary Rangers',
    15,
    'University Cricket Oval',
    ['Wicketkeeper', 'Opening batter', 'All-rounder', 'Fast bowler', 'Spin bowler']
  ],
  [
    'Volleyball',
    'Net Strikers',
    'Summit Spikers',
    9,
    'Sports Complex Volleyball Court',
    ['Setter', 'Outside hitter', 'Middle blocker', 'Libero']
  ],
  [
    'Kabaddi',
    'Mat Warriors',
    'Campus Raiders',
    10,
    'Indoor Kabaddi Hall',
    ['Corner defender', 'Raider', 'Cover defender']
  ],
  [
    'Hockey',
    'Turf Titans',
    'Valley Sticks',
    14,
    'University Hockey Turf',
    ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
  ],
  [
    'Handball',
    'Court Chargers',
    'Northside Throwers',
    10,
    'Multipurpose Indoor Hall',
    ['Goalkeeper', 'Wing', 'Pivot', 'Centre back']
  ],
  [
    'Badminton',
    'Shuttle Aces',
    'Rally Club',
    4,
    'Badminton Hall, Courts 1–4',
    ['Singles specialist', 'Doubles specialist']
  ],
  [
    'Tennis',
    'Baseline Club',
    'Campus Aces',
    4,
    'East Campus Tennis Courts',
    ['Singles player', 'Doubles player']
  ],
  [
    'Table tennis',
    'Paddle United',
    'Spin Society',
    4,
    'Student Activity Centre',
    ['Singles player', 'Doubles player']
  ],
  [
    'Chess',
    'Knight Collective',
    'Campus Gambit',
    4,
    'Library Tournament Room',
    ['Rapid chess', 'Classical chess']
  ],
  [
    'Athletics',
    'Track Collective',
    'Stride Club',
    4,
    'University Athletics Track',
    ['100m sprint', '400m sprint', '800m run', 'Long jump']
  ],
  [
    'Swimming',
    'Lane Breakers',
    'Aquatic Club',
    4,
    'University Aquatic Centre',
    ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly']
  ]
];
const first = [
  'Aarav',
  'Isha',
  'Kabir',
  'Meera',
  'Dev',
  'Riya',
  'Arjun',
  'Tara',
  'Vihaan',
  'Anaya',
  'Rehan',
  'Sana',
  'Aditya',
  'Nisha',
  'Kunal',
  'Diya',
  'Rohan',
  'Aditi',
  'Dhruv',
  'Zoya',
  'Ishaan',
  'Avni',
  'Siddharth',
  'Kavya',
  'Yash',
  'Mira',
  'Neel',
  'Pooja',
  'Aryan',
  'Sneha'
];
const last = [
  'Shah',
  'Patel',
  'Rao',
  'Singh',
  'Nair',
  'Kapoor',
  'Das',
  'Sen',
  'Roy',
  'Joshi',
  'Ali',
  'Khan',
  'Menon',
  'Verma',
  'Bose',
  'Iyer',
  'Malhotra',
  'Desai',
  'Kulkarni',
  'Sethi'
];
const original = [
  'Aarav Shah',
  'Isha Patel',
  'Kabir Rao',
  'Meera Singh',
  'Dev Nair',
  'Riya Kapoor',
  'Arjun Das',
  'Tara Sen',
  'Vihaan Roy',
  'Anaya Joshi',
  'Rehan Ali',
  'Sana Khan'
];
const departments = [
  'Computer Science',
  'Economics',
  'Mechanical Engineering',
  'Architecture',
  'Business Studies',
  'Applied Mathematics'
];
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME),
      now = new Date();
    const backup = {};
    for (const n of ['teams', 'players', 'tournaments', 'matches'])
      backup[n] = await db.collection(n).find({ isDemo: true }).toArray();
    const dir = path.resolve(__dirname, '../../.demo-backups');
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(dir, `before-refine-${Date.now()}.json`),
      JSON.stringify(backup, null, 2),
      { mode: 0o600 }
    );
    const hash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'CampusDemo@2026', 12);
    const put = async (n, key, fields) => {
      const seedKey = `campusarena-demo-v1:${key}`;
      const old = await db.collection(n).findOne({ seedKey });
      if (old) return old;
      const doc = { ...fields, seedKey, isDemo: true, createdAt: now, updatedAt: now };
      const r = await db.collection(n).insertOne(doc);
      return { ...doc, _id: r.insertedId };
    };
    const refine = async (n, doc, fields) => {
      if (!doc.isDemo) throw Error('Refusing to edit non-demo record');
      await db
        .collection(n)
        .updateOne({ _id: doc._id, isDemo: true }, { $set: { ...fields, updatedAt: now } });
      return { ...doc, ...fields };
    };
    const date = (days) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(10, 30, 0, 0);
      return d;
    };
    let serial = 120;
    const staff = {};
    for (const [key, role, name] of [
      ['referee', 'referee', 'Vikram Mehta'],
      ['manager', 'event_manager', 'Priya Suri']
    ]) {
      const u = await put('users', key, {
        name,
        role,
        email: `demo.${key}@campusarena.example`,
        passwordHash: hash
      });
      staff[key] = await refine('users', u, { name });
    }
    for (let si = 0; si < catalog.length; si++) {
      const [sport, a, b, size, venue, positions] = catalog[si],
        pair = [],
        rosters = [];
      for (let side = 0; side < 2; side++) {
        const legacy = si < 2 ? si * 2 + side : null,
          name = side ? b : a;
        let team = await put(
          'teams',
          legacy === null ? `sport-${si}-team-${side}` : `team-${legacy}`,
          { name, sport, players: [], captainId: null }
        );
        team = await refine('teams', team, {
          name,
          sport,
          homeVenue: venue,
          bio: `${name} represents ${side ? 'North' : 'South'} Campus in ${sport.toLowerCase()}. Weekly training at ${venue}.`
        });
        const roster = [];
        for (let slot = 0; slot < size; slot++) {
          const oldIndex = legacy !== null && slot < 3 ? legacy * 3 + slot : null,
            n = serial++;
          const name =
            oldIndex === null
              ? `${first[n % first.length]} ${last[Math.floor(n / first.length) % last.length]}`
              : original[oldIndex];
          const key =
            oldIndex === null ? `sport-${si}-side-${side}-player-${slot}` : `player-${oldIndex}`;
          const email =
            oldIndex === null
              ? `${key}@campusarena.example`
              : `demo.player${oldIndex + 1}@campusarena.example`;
          const user = await put(
            'users',
            oldIndex === null ? `account-${key}` : `user-${oldIndex}`,
            { name, email, role: 'player', passwordHash: hash }
          );
          let player = await put('players', key, {
            name,
            email,
            userId: user._id,
            username: `${name.toLowerCase().replace(/ /g, '_').slice(0, 12)}_${si}_${side}_${slot}`,
            sport,
            interestedSports: [sport],
            teamId: team._id
          });
          if (player.username?.length > 20)
            player = await refine('players', player, {
              username: `${name.toLowerCase().replace(/ /g, '_').slice(0, 12)}_${si}_${side}_${slot}`
            });
          const position = positions[slot % positions.length],
            department = departments[(si + slot) % departments.length];
          player = await refine('players', player, {
            name,
            jerseyNumber: slot + 1,
            position,
            department,
            studyYear: 2 + (slot % 3),
            bio: `${position} for ${team.name}. Year ${2 + (slot % 3)}, ${department}. ${slot === 0 ? 'Team captain; coordinates training and matchday lineups.' : slot % 2 ? 'Focuses on consistent technique and match preparation.' : 'Brings competitive fitness and a team-first approach.'}`
          });
          await db.collection('players').updateOne(
            { _id: player._id },
            {
              $addToSet: {
                teamIds: team._id,
                interestedSports: sport,
                teamSportKeys: sport.toLowerCase()
              }
            }
          );
          roster.push(player);
        }
        const captain = roster.find((p) => String(p._id) === String(team.captainId)) || roster[0];
        await db.collection('teams').updateOne(
          { _id: team._id },
          {
            $addToSet: { players: { $each: roster.map((p) => p._id) } },
            $set: {
              captainId: team.captainId || captain._id,
              createdBy: team.createdBy || captain.userId,
              updatedAt: now
            }
          }
        );
        pair.push(team);
        rosters.push(roster);
      }
      const lineupRules = rules[sport.toLowerCase()];
      let tournament = await put(
        'tournaments',
        si < 2 ? `tournament-${si}` : `sport-${si}-tournament`,
        {
          name: `${sport} Interdepartment Championship`,
          sport,
          venue,
          startDate: date(3 + si),
          status: 'upcoming',
          teamIds: pair.map((t) => t._id),
          playerIds: []
        }
      );
      tournament = await refine('tournaments', tournament, {
        name:
          si === 0
            ? 'Basketball Campus Championship'
            : si === 1
              ? 'Freshers Football League'
              : `${sport} Interdepartment Championship`,
        venue,
        lineupRules
      });
      for (let side = 0; side < 2; side++) {
        if (tournament.teamEntries?.[String(pair[side]._id)]) continue;
        const starters = rosters[side].slice(0, lineupRules.starters).map((p) => String(p._id));
        const substitutes = rosters[side]
          .slice(lineupRules.starters, lineupRules.starters + lineupRules.substitutes)
          .map((p) => String(p._id));
        const entered = rosters[side].filter((p) =>
          [...starters, ...substitutes].includes(String(p._id))
        );
        // Existing user entries are retained, including their roster locks.
        const locks = new Set(tournament.enteredPlayerIds || []);
        if (entered.some((p) => locks.has(String(p.userId)))) continue;
        await db.collection('tournaments').updateOne(
          { _id: tournament._id },
          {
            $set: {
              [`teamEntries.${pair[side]._id}`]: {
                starters,
                substitutes,
                captainId: starters[0]
              },
              ...Object.fromEntries(entered.map((p) => [`playerTeams.${p.userId}`, pair[side]._id]))
            },
            $addToSet: {
              teamIds: pair[side]._id,
              playerIds: { $each: entered.map((p) => p.userId) },
              enteredPlayerIds: { $each: entered.map((p) => String(p.userId)) }
            }
          }
        );
      }
      if (si >= 2)
        await put('matches', `sport-${si}-opening-match`, {
          tournamentId: tournament._id,
          teamA: pair[0]._id,
          teamB: pair[1]._id,
          refereeId: staff.referee._id,
          scheduledAt: date(3 + si),
          status: 'scheduled',
          score: { teamA: 0, teamB: 0 },
          timeline: [
            {
              type: 'scheduled',
              message: `Opening fixture: ${pair[0].name} vs ${pair[1].name}`,
              timestamp: now.toISOString()
            }
          ]
        });
    }
    const finals = await db
      .collection('tournaments')
      .findOne({ seedKey: 'campusarena-demo-v1:tournament-2', isDemo: true });
    if (finals)
      await refine('tournaments', finals, {
        name: 'Basketball Autumn Invitational',
        venue: 'University Indoor Arena',
        lineupRules: rules.basketball
      });
    const counts = {};
    for (const n of ['teams', 'players', 'tournaments', 'matches'])
      counts[n] = await db.collection(n).countDocuments({ isDemo: true });
    console.log(JSON.stringify({ sports: catalog.length, ...counts, backup: dir }, null, 2));
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
