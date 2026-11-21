// External scanner for tree-sitter-junos.
//
// Emits a single token, `_newline`, which ends a `set ...` command. The
// parser only marks it valid while inside a set command, so in the
// hierarchical (curly-brace) format newlines remain plain whitespace.

#include "tree_sitter/parser.h"

enum TokenType {
  NEWLINE,
};

void *tree_sitter_junos_external_scanner_create(void) { return NULL; }

void tree_sitter_junos_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_junos_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_junos_external_scanner_deserialize(void *payload, const char *buffer,
                                                    unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_junos_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  (void)payload;

  if (!valid_symbols[NEWLINE]) {
    return false;
  }

  // Skip horizontal whitespace, but never a newline.
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }

  if (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = NEWLINE;
    return true;
  }

  // A final set command with no trailing newline still terminates.
  if (lexer->eof(lexer)) {
    lexer->mark_end(lexer);
    lexer->result_symbol = NEWLINE;
    return true;
  }

  return false;
}
