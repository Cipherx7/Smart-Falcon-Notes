const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { smartSearch } = require('../services/gemini');

// GET /api/search?q=... — Hybrid search with AI
router.get('/', async (req, res) => {
  try {
    const { q, mode } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = q.trim();
    let notes = [];

    // Step 1: Try MongoDB text search
    try {
      notes = await Note.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } }).limit(20);
    } catch (e) {
      // Text search might fail if index not ready
      console.log('Text search fallback:', e.message);
    }

    // Step 2: If text search returned nothing, try regex
    if (notes.length === 0) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQuery, 'i');

      notes = await Note.find({
        $or: [
          { rawInput: regex },
          { title: regex },
          { tags: regex },
          { 'structured.summary': regex },
          { 'structured.whenToUse': regex },
          { 'structured.howToUse': regex },
          { 'structured.whyToUse': regex },
          { 'structured.tips': regex },
          { 'structured.commands.syntax': regex },
          { 'structured.commands.description': regex },
          { 'structured.commands.example': regex },
          { 'structured.codeSnippets.code': regex },
          { 'structured.codeSnippets.description': regex }
        ]
      }).sort({ createdAt: -1 }).limit(20);
    }

    // Step 3: Get AI-powered answer
    let aiAnswer = null;
    try {
      // Send all notes if fewer than 20, otherwise send what we found
      const contextNotes = notes.length > 0 ? notes : await Note.find().sort({ createdAt: -1 }).limit(20);
      aiAnswer = await smartSearch(query, contextNotes, mode);
    } catch (e) {
      console.error('AI search error:', e.message);
      aiAnswer = 'AI search is currently unavailable. Showing regex/text matches below.';
    }

    res.json({
      success: true,
      query,
      aiAnswer,
      notes,
      totalResults: notes.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

module.exports = router;
