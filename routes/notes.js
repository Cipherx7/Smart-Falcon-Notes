const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { processKnowledge } = require('../services/gemini');

// POST /api/notes — Process raw text with Gemini and save
router.post('/', async (req, res) => {
  try {
    const { rawInput } = req.body;

    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ error: 'Raw input text is required' });
    }

    // Process with Gemini AI
    const processed = await processKnowledge(rawInput);

    // Create note in MongoDB
    const note = new Note({
      rawInput: rawInput.trim(),
      title: processed.title || 'Untitled Note',
      category: processed.category || 'general',
      structured: processed.structured || {},
      tags: processed.tags || []
    });

    await note.save();

    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      error: 'Failed to process and save note',
      details: error.message
    });
  }
});

// GET /api/notes — List all notes (optional category filter)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }

    const notes = await Note.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/:id — Get single note
router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, note });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// DELETE /api/notes/:id — Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
