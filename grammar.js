/**
 * Tree-sitter grammar for Juniper Junos configuration files.
 *
 * Handles both display formats:
 *
 *   1. Hierarchical (curly-brace) format, as shown by `show configuration`:
 *        interfaces {
 *            inactive: ge-0/0/0 {
 *                unit 0 { family inet { address 10.0.0.1/24; } }
 *            }
 *        }
 *
 *   2. Set format, as shown by `show configuration | display set`
 *      (one command per line, no braces or semicolons):
 *        set interfaces ge-0/0/0 unit 0 family inet address 10.0.0.1/24
 *
 * Set commands are line-terminated, which tree-sitter can't express with
 * extras alone, so a tiny external scanner (src/scanner.c) emits `_newline`
 * only while a set command is being parsed. Everywhere else newlines are
 * ordinary whitespace.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const SET_KEYWORDS = [
  'set',
  'delete',
  'deactivate',
  'activate',
  'protect',
  'unprotect',
  'annotate',
  'insert',
  'rename',
  'replace',
  'copy',
  'load',
];

// Prefix modifiers used in hierarchical configs and `load` files.
const MODIFIERS = [
  'inactive',
  'active',
  'replace',
  'merge',
  'override',
  'delete',
  'protect',
  'unprotect',
];

// Common physical and logical interface name prefixes.
const IFACE_PREFIXES =
  'ge|xe|et|fe|ae|lo|irb|vlan|fxp|em|me|reth|st|gr|ip|lt|so|at|se|vt|vme|ms|sp|fab';

module.exports = grammar({
  name: 'junos',

  externals: $ => [$._newline],

  extras: $ => [/\s/, $.comment],

  rules: {
    // Set commands are only recognised at the top level, so words like
    // `set` or `delete` inside a hierarchical block stay ordinary words
    // (e.g. `then community set FOO;`).
    source_file: $ => repeat(choice($.set_command, $._item)),

    _item: $ => choice($.block, $.statement),

    // `name { ... }`
    block: $ => seq($._head, '{', repeat($._item), '}'),

    // `name value value;`
    statement: $ => seq($._head, ';'),

    // Shared by block and statement so the parser doesn't see two
    // competing `repeat1` expansions with the same prefix.
    _head: $ => seq(
      optional(field('modifier', $.modifier)),
      field('name', $._name),
      repeat($._arg),
    ),

    // `set interfaces ge-0/0/0 unit 0 ...<newline>`
    set_command: $ => seq(
      field('command', $.set_keyword),
      field('name', $._name),
      repeat($._arg),
      $._newline,
    ),

    // The first word of a statement/block/set path is a hierarchy keyword.
    _name: $ => choice(alias($.word, $.keyword), $._value),

    _arg: $ => choice($.word, $._value),

    _value: $ => choice(
      $.string,
      $.secret,
      $.variable,
      $.ip_address,
      $.ipv6_address,
      $.interface,
      $.number,
      $.wildcard,
      $.list,
    ),

    // `[ a b c ]`
    list: $ => seq('[', repeat($._arg), ']'),

    set_keyword: _ => token(prec(5, choice(...SET_KEYWORDS))),

    modifier: _ => token(prec(6, seq(choice(...MODIFIERS), ':'))),

    word: _ => /[^\s;{}\[\]"]+/,

    string: _ => /"([^"\\]|\\[\s\S])*"/,

    // Encrypted secrets: $9$..., $1$..., $5$..., $6$...
    secret: _ => token(prec(4, /\$[0-9]\$[^\s;"]+/)),

    // Junos macros/variables such as $junos-interface-ifd-name
    variable: _ => token(prec(3, /\$[a-zA-Z][a-zA-Z0-9_-]*/)),

    ip_address: _ => token(prec(2, /\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?/)),

    ipv6_address: _ => token(
      prec(2, /[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,}(\/\d{1,3})?/),
    ),

    // ge-0/0/0, xe-1/2/3:4, ae0, lo0.0, irb.100
    interface: _ => token(prec(
      3,
      new RegExp(`(${IFACE_PREFIXES})-?[0-9]+(\\/[0-9]+){0,3}(:[0-9]+)?(\\.[0-9]+)?`),
    )),

    number: _ => token(prec(2, /\d+/)),

    // Wildcards in groups: <*>, <ge-*>
    wildcard: _ => token(prec(2, /<[^>\s]+>/)),

    comment: _ => token(prec(2, choice(
      seq('#', /[^\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    ))),
  },
});
