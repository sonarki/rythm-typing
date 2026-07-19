export {
  INITIALS,
  MEDIALS,
  FINALS,
  COMPOUND_MEDIALS,
  DOUBLE_FINALS,
  COMPOUND_MEDIAL_SPLIT,
  DOUBLE_FINAL_SPLIT,
  isVowelJamo,
  isConsonantJamo,
  canBeInitial,
  canBeFinal,
  isHangulSyllable,
  composeSyllable,
  decomposeSyllable,
} from './jamo'
export type { SyllableJamo } from './jamo'
export { DUBEOLSIK, JAMO_TO_KEYSTROKE, keyToJamo } from './layout'
export type { KeyJamo, Keystroke } from './layout'
export { HangulAutomaton } from './automaton'
export type { JamoRole, JamoEvent, CommittedSyllable } from './automaton'
export { decomposeText, syllableToJamoKeys, strokeCounts } from './decompose'
export type { CharStrokes } from './decompose'
