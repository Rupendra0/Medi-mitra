import User from '../models/User.js';

export const listSockets = (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) return res.status(500).json({ message: 'Socket server not available.' });

    const sockets = [];
    for (const [id, socket] of io.of('/').sockets) {
      sockets.push({ id, rooms: Array.from(socket.rooms), user: socket.data.user || null });
    }

    res.json({ sockets });
  } catch (err) {
    console.error('listSockets error:', err);
    res.status(500).json({ message: 'Failed to list sockets.' });
  }
};

export const listUsers = async (req, res) => {
  try {
    const role = req.query.role;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select('_id name role uniqueId specialization');
    res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ message: 'Failed to list users.' });
  }
};
