require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'money-manager.db'),
  logging: false, // Set to console.log for SQL debugging
});

// Define Transaction model
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.ENUM('income', 'expense', 'transfer'),
    allowNull: false,
  },
  division: {
    type: DataTypes.ENUM('office', 'personal'),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
  },
  description: {
    type: DataTypes.STRING,
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fromAccount: {
    type: DataTypes.STRING,
  },
  toAccount: {
    type: DataTypes.STRING,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false, // We're managing timestamps manually
  tableName: 'transactions',
});

// Sync database
sequelize.sync({ alter: false }).then(() => {
  console.log('Database synced successfully');
}).catch((err) => {
  console.error('Database sync error:', err.message);
  process.exit(1);
});

// Add transaction
app.post('/api/transaction', async (req, res) => {
  try {
    const tx = await Transaction.create(req.body);
    res.json(tx);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Edit transaction (only within 12 hours)
app.put('/api/transaction/:id', async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Not found' });
    
    const diff = (Date.now() - new Date(tx.createdAt).getTime()) / (1000 * 60 * 60);
    if (diff > 12) return res.status(403).json({ error: 'Edit window expired' });
    
    await tx.update(req.body);
    res.json(tx);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get transactions (filter by division, category, date range)
app.get('/api/transactions', async (req, res) => {
  try {
    const { division, category, start, end } = req.query;
    const where = {};
    
    if (division) where.division = division;
    if (category) where.category = category;
    if (start && end) {
      where.date = {
        [Sequelize.Op.gte]: new Date(start),
        [Sequelize.Op.lte]: new Date(end),
      };
    }
    
    const txs = await Transaction.findAll({
      where,
      order: [['date', 'DESC']],
    });
    res.json(txs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get summary of categories
app.get('/api/summary/categories', async (req, res) => {
  try {
    const summary = await Transaction.findAll({
      attributes: [
        'category',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
      ],
      group: ['category'],
      raw: true,
    });
    res.json(summary);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Transfer between accounts
app.post('/api/transfer', async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, division, category, description } = req.body;
    const tx = await Transaction.create({
      type: 'transfer',
      fromAccount,
      toAccount,
      amount,
      division,
      category,
      description,
    });
    res.json(tx);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
