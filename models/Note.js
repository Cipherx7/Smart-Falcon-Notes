const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
  syntax: String,
  description: String,
  example: String
}, { _id: false });

const codeSnippetSchema = new mongoose.Schema({
  language: String,
  code: String,
  description: String
}, { _id: false });

const structuredSchema = new mongoose.Schema({
  summary: String,
  commands: [commandSchema],
  codeSnippets: [codeSnippetSchema],
  whenToUse: String,
  howToUse: String,
  whyToUse: String,
  tips: [String],
  relatedTopics: [String]
}, { _id: false });

const noteSchema = new mongoose.Schema({
  rawInput: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['command', 'note', 'code', 'concept', 'troubleshooting', 'general'],
    default: 'general'
  },
  structured: structuredSchema,
  tags: [String]
}, {
  timestamps: true
});

// Text index for full-text search
noteSchema.index({
  rawInput: 'text',
  title: 'text',
  tags: 'text',
  'structured.summary': 'text'
});

module.exports = mongoose.model('Note', noteSchema);
