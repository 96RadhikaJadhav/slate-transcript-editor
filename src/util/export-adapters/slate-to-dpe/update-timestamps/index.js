/**
 * converted from react-transcript-editor draftJS update timestamp helper function
 * https://github.com/pietrop/react-transcript-editor/blob/master/packages/components/timed-text-editor/UpdateTimestamps/index.js
 *
 */
import { shortTimecode } from '../../../timecode-converter';
import { generatePreviousTimingsUpToCurrentOne } from '../../../dpe-to-slate';
import countWords from '../../../count-words';
import updateTimestampsHelper from './update-timestamps-helper';
/**
 * Transposes the timecodes from stt json list of words onto
 * slateJs value paragraphs
 */
export const createSlateContentFromSlateJsParagraphs = (currentContent, newEntities) => {
  // Update entites to block structure.
  const updatedBlockArray = [];
  let totalWords = 0;

  for (const blockIndex in currentContent) {
    const block = currentContent[blockIndex];
    const text = block.children[0].text;
    // if copy and pasting large chunk of text
    // currentContentBlock, would not have speaker and start/end time info
    // so for updatedBlock, getting start time from first word in blockEntities
    // const wordsInBlock = (text.match(/\S+/g) || []).length;
    const wordsInBlock = countWords(text);
    const blockEntites = newEntities.slice(totalWords, totalWords + wordsInBlock);
    let speaker = block.speaker;
    const start = parseFloat(blockEntites[0].start);
    if (!speaker) {
      speaker = 'U_UKN';
    }
    const updatedBlock = {
      type: 'timedText',
      speaker: speaker,
      start,
      previousTimings: generatePreviousTimingsUpToCurrentOne(blockEntites, start),
      startTimecode: shortTimecode(start),
      children: [{ text }],
    };

    updatedBlockArray.push(updatedBlock);
    totalWords += wordsInBlock;
  }
  return updatedBlockArray;
};

/**
 * Update timestamps usign stt-align module
 * @param {*} currentContent - slate js value
 * @param {*} words - list of stt words
 * @return slateJS value
 */
const updateTimestamps = (currentContent, words) => {
  const alignedWords = updateTimestampsHelper(currentContent, words);
  const updatedContent = createSlateContentFromSlateJsParagraphs(currentContent, alignedWords);
  return updatedContent;
};

export default updateTimestamps;
