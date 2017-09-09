const mongoose = require('mongoose');

const snippetSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    language: { type: String, required: true },
    body: { type: String, required: true },
    optionalNotes: { type: String },
    tags: { type: String }


})

snippetSchema.methods.findsnippetsFromSameTags = function(callback) {
  return this.model('snippet').find({
    tags: this.tags,
    _id: {$ne: this._id}
  }, callback);
}

snippetSchema.methods.findsnippetsFromSameLanguage = function(callback) {
  return this.model('snippet').find({
    language: this.language,
    _id: {$ne: this._id}
  }, callback);
}

const Snippet = mongoose.model('Snippet', snippetSchema);

module.exports = {
    Snippet: Snippet
  };
