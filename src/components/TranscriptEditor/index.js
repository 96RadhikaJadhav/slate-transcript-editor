import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createEditor, Editor, Transforms } from 'slate';
// https://docs.slatejs.org/walkthroughs/01-installing-slate
// Import the Slate components and React plugin.
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import PropTypes from 'prop-types';
import path from 'path';
import { faSave, faShare, faUndo, faSync, faInfoCircle, faMehBlank, faPause, faMusic, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from 'react-bootstrap/Button';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ListGroup from 'react-bootstrap/ListGroup';
import Accordion from 'react-bootstrap/Accordion';
import { shortTimecode } from '../../util/timecode-converter';
import download from '../../util/downlaod/index.js';
import convertDpeToSlate from '../../util/dpe-to-slate';
// TODO: This should be moved in export utils
import insertTimecodesInline from '../../util/inline-interval-timecodes';
import pluck from '../../util/pluk';
import subtitlesExportOptionsList from '../../util/export-adapters/subtitles-generator/list.js';
import updateTimestamps from '../../util/update-timestamps';
import exportAdapter from '../../util/export-adapters';
import TimedTextEditor from '../TimedTextEditor';
const PLAYBACK_RATE_VALUES = [0.2, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5];
const SEEK_BACK_SEC = 15;
const PAUSE_WHILTE_TYPING_TIMEOUT_MILLISECONDS = 1500;
const MAX_DURATION_FOR_PERFORMANCE_OPTIMIZATION_IN_SECONDS = 3600;
const TOOTLIP_DELAY = 1000;
const TOOTLIP_LONGER_DELAY = 2000;

const mediaRef = React.createRef();

export default function SlateTranscriptEditor(props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  // const editor = useMemo(() => withReact(withHistory(createEditor())), []);
  const [value, setValue] = useState([]);
  const defaultShowSpeakersPreference = typeof props.showSpeakers === 'boolean' ? props.showSpeakers : true;
  const defaultShowTimecodesPreference = typeof props.showTimecodes === 'boolean' ? props.showTimecodes : true;
  const [showSpeakers, setShowSpeakers] = useState(defaultShowSpeakersPreference);
  const [showTimecodes, setShowTimecodes] = useState(defaultShowTimecodesPreference);
  const [speakerOptions, setSpeakerOptions] = useState([]);
  const [showSpeakersCheatShet, setShowSpeakersCheatShet] = useState(false);
  // const [saveTimer, setSaveTimer] = useState(null);
  const [isPauseWhiletyping, setIsPauseWhiletyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // used isContentModified to avoid unecessarily run alignment if the slate value contnet has not been modified by the user since
  // last save or alignment
  const [isContentModified, setIsContentIsModified] = useState(false);

  // this.timedTextEditorRef = React.createRef();
  const timedTextEditorRef = useRef();
  useEffect(() => {
    if (isProcessing) {
      document.body.style.cursor = 'wait';
    } else {
      document.body.style.cursor = 'default';
    }
  }, [isProcessing]);

  useEffect(() => {
    if (props.transcriptData) {
      const res = convertDpeToSlate(props.transcriptData);
      setValue(res);
    }
  }, []);

  useEffect(() => {
    const getUniqueSpeakers = pluck('speaker');
    const uniqueSpeakers = getUniqueSpeakers(value);
    setSpeakerOptions(uniqueSpeakers);
    return () => ({});
  }, [showSpeakersCheatShet]);

  useEffect(() => {
    // Update the document title using the browser API
    if (mediaRef && mediaRef.current) {
      // setDuration(mediaRef.current.duration);
      mediaRef.current.addEventListener('timeupdate', handleTimeUpdated);
    }
    return function cleanup() {
      // removeEventListener
      mediaRef.current.removeEventListener('timeupdate', handleTimeUpdated);
    };
  }, []);

  useEffect(() => {
    console.log('here');
  }, [timedTextEditorRef.timedTextEditorRef]);

  useEffect(() => {
    // Update the document title using the browser API
    if (mediaRef && mediaRef.current) {
      // Not working
      setDuration(mediaRef.current.duration);
      // if (mediaRef.current.duration >= MAX_DURATION_FOR_PERFORMANCE_OPTIMIZATION_IN_SECONDS) {
      //   setShowSpeakers(false);
      //   showTimecodes(false);
      // }
    }
  }, [mediaRef]);

  const getSlateContent = () => {
    return timedTextEditorRef && timedTextEditorRef.current && timedTextEditorRef.current.getSlateContent();
    // return value;
  };

  const getFileTitle = () => {
    if (props.title) {
      return props.title;
    }
    return path.basename(props.mediaUrl).trim();
  };

  const getMediaType = () => {
    const clipExt = path.extname(props.mediaUrl);
    let tmpMediaType = props.mediaType ? props.mediaType : 'video';
    if (clipExt === '.wav' || clipExt === '.mp3' || clipExt === '.m4a' || clipExt === '.flac' || clipExt === '.aiff') {
      tmpMediaType = 'audio';
    }
    return tmpMediaType;
  };

  const breakParagraph = () => {
    Editor.insertBreak(editor);
  };
  const insertTextInaudible = () => {
    Transforms.insertText(editor, '[INAUDIBLE]');
  };

  const handleInsertMusicNote = () => {
    Transforms.insertText(editor, '♫'); // or ♪
  };

  const handleSetShowSpeakersCheatShet = () => {
    setShowSpeakersCheatShet(!showSpeakersCheatShet);
  };

  const handleTimeUpdated = (e) => {
    setCurrentTime(e.target.currentTime);
    // TODO: setting duration here as a workaround
    setDuration(mediaRef.current.duration);
  };

  const handleSetPlaybackRate = (e) => {
    const tmpNewPlaybackRateValue = parseFloat(e.target.value);
    if (mediaRef && mediaRef.current) {
      mediaRef.current.playbackRate = tmpNewPlaybackRateValue;
      setPlaybackRate(tmpNewPlaybackRateValue);
    }
  };

  const handleSeekBack = () => {
    if (mediaRef && mediaRef.current) {
      mediaRef.current.currentTime = mediaRef.current.currentTime - SEEK_BACK_SEC;
    }
  };

  const onWordClick = (start) => {
    if (mediaRef && mediaRef.current) {
      mediaRef.current.currentTime = parseFloat(start);
      mediaRef.current.play();
    }
  };

  // TODO: refacto this function, to be cleaner and easier to follow.
  const handleRestoreTimecodes = async (inlineTimecodes = false) => {
    if (!isContentModified && !inlineTimecodes) {
      return value;
    }
    if (inlineTimecodes) {
      const transcriptData = insertTimecodesInline({ transcriptData: props.transcriptData });
      const alignedSlateData = await updateTimestamps(convertDpeToSlate(transcriptData), transcriptData);
      setValue(alignedSlateData);
      setIsContentIsModified(false);
      return alignedSlateData;
    } else {
      const alignedSlateData = await updateTimestamps(value, props.transcriptData);
      setValue(alignedSlateData);
      setIsContentIsModified(false);
      return alignedSlateData;
    }
  };

  const handleExport = async ({ type, ext, speakers, timecodes, inlineTimecodes, hideTitle, atlasFormat, isDownload }) => {
    try {
      setIsProcessing(true);
      let tmpValue = getSlateContent();
      if (timecodes) {
        tmpValue = await handleRestoreTimecodes();
      }

      if (inlineTimecodes) {
        tmpValue = await handleRestoreTimecodes(inlineTimecodes);
      }

      if (isContentModified && type === 'json-slate') {
        tmpValue = await handleRestoreTimecodes();
      }

      let editorContnet = exportAdapter({
        slateValue: tmpValue,
        type,
        transcriptTitle: getFileTitle(),
        speakers,
        timecodes,
        inlineTimecodes,
        hideTitle,
        atlasFormat,
        dpeTranscriptData: props.transcriptData,
      });

      if (ext === 'json') {
        editorContnet = JSON.stringify(editorContnet, null, 2);
      }
      if (ext !== 'docx' && isDownload) {
        download(editorContnet, `${getFileTitle()}.${ext}`);
      }
      return editorContnet;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      const format = props.autoSaveContentType ? props.autoSaveContentType : 'digitalpaperedit';
      const editorContnet = await handleExport({ type: `json-${format}`, isDownload: false });
      if (props.handleSaveEditor) {
        props.handleSaveEditor(editorContnet);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetPauseWhileTyping = () => {
    setIsPauseWhiletyping(!isPauseWhiletyping);
  };

  return (
    <Container fluid style={{ backgroundColor: '#eee', height: '100vh', paddingTop: '1em' }}>
      {props.showTitle ? (
        <OverlayTrigger delay={TOOTLIP_LONGER_DELAY} placement={'bottom'} overlay={<Tooltip id="tooltip-disabled"> {props.title}</Tooltip>}>
          <h3 className={'text-truncate text-left'}>
            <small className="text-muted">{props.title}</small>
          </h3>
        </OverlayTrigger>
      ) : null}
      <Row>
        <Col
          xs={{ span: 12, order: 1 }}
          sm={getMediaType() === 'audio' ? { span: 10, offset: 1 } : 3}
          md={getMediaType() === 'audio' ? { span: 10, offset: 1 } : 3}
          lg={getMediaType() === 'audio' ? { span: 8, offset: 2 } : 3}
          xl={getMediaType() === 'audio' ? { span: 8, offset: 2 } : 3}
        >
          <Row>
            <video
              ref={mediaRef}
              src={props.mediaUrl}
              width={'100%'}
              height={getMediaType() === 'audio' ? '60em' : 'auto'}
              controls
              playsInline
            ></video>
          </Row>
          <Row>
            <Col xs={5} sm={4} md={4} lg={4} xl={4} className={'p-1 mx-auto'}>
              <Badge variant="light" pill>
                <code className={'text-muted'}>{shortTimecode(currentTime)}</code>
                <code className={'text-muted'}>{duration ? ` | ${shortTimecode(duration)}` : ''}</code>
              </Badge>
            </Col>
            <Col xs={4} sm={4} md={4} lg={4} xl={4} className={'p-1 mx-auto'}>
              <Form.Control
                as="select"
                defaultValue={playbackRate}
                onChange={handleSetPlaybackRate}
                title={'Change the playback speed of the player'}
              >
                {PLAYBACK_RATE_VALUES.map((playbackRateValue, index) => {
                  return (
                    <option key={index + playbackRateValue} value={playbackRateValue}>
                      x {playbackRateValue}
                    </option>
                  );
                })}
              </Form.Control>
            </Col>
            <Col xs={3} sm={3} md={3} lg={3} xl={3} className={'p-1 mx-auto'}>
              <OverlayTrigger
                delay={TOOTLIP_DELAY}
                placement={'bottom'}
                overlay={<Tooltip id="tooltip-disabled">{`Seek back by ${SEEK_BACK_SEC} seconds`}</Tooltip>}
              >
                <span className="d-inline-block">
                  <Button variant="light" onClick={handleSeekBack} block>
                    {SEEK_BACK_SEC} <FontAwesomeIcon icon={faUndo} />
                  </Button>
                </span>
              </OverlayTrigger>
            </Col>
          </Row>
          <Row>
            <Col xs={12} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <Accordion onClick={handleSetShowSpeakersCheatShet}>
                <Accordion.Toggle as={Button} variant="link" eventKey="0">
                  <Badge variant="light">Speakers</Badge>
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="0">
                  <ListGroup>
                    {speakerOptions.map((speakerName, index) => {
                      return (
                        <ListGroup.Item key={index + speakerName} className={'text-truncate'} title={speakerName.toUpperCase()}>
                          {speakerName.toUpperCase()}
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                </Accordion.Collapse>
              </Accordion>
            </Col>
          </Row>
        </Col>

        <Col
          xs={{ span: 12, order: 3 }}
          sm={getMediaType() === 'audio' ? { span: 10, order: 2, offset: 1 } : { span: 7, order: 2 }}
          md={getMediaType() === 'audio' ? { span: 10, order: 2, offset: 1 } : { span: 7, order: 2 }}
          lg={getMediaType() === 'audio' ? { span: 8, order: 2, offset: 2 } : { span: 8, order: 2 }}
          xl={getMediaType() === 'audio' ? { span: 8, order: 2, offset: 2 } : { span: 7, order: 2 }}
        >
          <TimedTextEditor
            mediaUrl={props.mediaUrl}
            isEditable={props.isEditable}
            autoSaveContentType={props.autoSaveContentType}
            showTimecodes={showTimecodes}
            showSpeakers={showSpeakers}
            title={props.title}
            transcriptData={props.transcriptData}
            handleSaveEditor={props.handleSaveEditor}
            showTitle={props.showTitle}
            currentTime={currentTime}
            //
            isPauseWhiletyping={isPauseWhiletyping}
            onWordClick={onWordClick}
            handleAnalyticsEvents={props.handleAnalyticsEvents}
            getSlateContent={getSlateContent}
            ref={timedTextEditorRef}
            mediaRef={mediaRef}
            transcriptDataLive={props.transcriptDataLive}
          />
        </Col>

        <Col xs={{ span: 12, order: 2 }} sm={{ span: 2, order: 3 }} md={{ span: 2, order: 3 }} lg={{ span: 1, order: 3 }} xl={{ span: 2, order: 3 }}>
          <Row>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                OverlayTrigger
                delay={TOOTLIP_LONGER_DELAY}
                placement={'bottom'}
                overlay={<Tooltip id="tooltip-disabled">Export options</Tooltip>}
              >
                <span className="d-inline-block">
                  <DropdownButton disabled={isProcessing} id="dropdown-basic-button" title={<FontAwesomeIcon icon={faShare} />} variant="light">
                    {/* TODO: need to run re-alignement if exportin with timecodes true, otherwise they'll be inaccurate */}
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'text',
                          ext: 'txt',
                          speakers: false,
                          timecodes: false,
                          isDownload: true,
                        });
                      }}
                    >
                      Text (<code>.txt</code>)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'text',
                          ext: 'txt',
                          speakers: true,
                          timecodes: false,
                          isDownload: true,
                        });
                      }}
                    >
                      Text (Speakers)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'text',
                          ext: 'txt',
                          speakers: false,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                    >
                      Text (Timecodes)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'text',
                          ext: 'txt',
                          speakers: true,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                      disable
                    >
                      Text (Speakers & Timecodes)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'text',
                          ext: 'txt',
                          speakers: true,
                          timecodes: true,
                          atlasFormat: true,
                          isDownload: true,
                        });
                      }}
                      disable
                    >
                      Text (Atlas format)
                    </Dropdown.Item>
                    {/* TODO: need to run re-alignement if exportin with timecodes true */}
                    <Dropdown.Divider />
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'word',
                          ext: 'docx',
                          speakers: false,
                          timecodes: false,
                          isDownload: true,
                        });
                      }}
                    >
                      Word (<code>.docx</code>)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'word',
                          ext: 'docx',
                          speakers: true,
                          timecodes: false,
                          isDownload: true,
                        });
                      }}
                    >
                      Word (Speakers)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'word',
                          ext: 'docx',
                          speakers: false,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                    >
                      Word (Timecodes)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'word',
                          ext: 'docx',
                          speakers: true,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                    >
                      Word (Speakers & Timecodes)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'word',
                          ext: 'docx',
                          speakers: false,
                          timecodes: false,
                          inlineTimecodes: true,
                          hideTitle: true,
                        });
                      }}
                    >
                      Word (OHMS)
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'json-slate',
                          ext: 'json',
                          speakers: true,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                    >
                      SlateJs (<code>.json</code>)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => {
                        handleExport({
                          type: 'json-digitalpaperedit',
                          ext: 'json',
                          speakers: true,
                          timecodes: true,
                          isDownload: true,
                        });
                      }}
                    >
                      DPE (<code>.json</code>)
                    </Dropdown.Item>
                  </DropdownButton>
                </span>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                OverlayTrigger
                delay={TOOTLIP_LONGER_DELAY}
                placement={'bottom'}
                overlay={<Tooltip id="tooltip-disabled">Export in caption format</Tooltip>}
              >
                <DropdownButton
                  disabled={isProcessing}
                  id="dropdown-basic-button"
                  title={<FontAwesomeIcon icon={faClosedCaptioning} />}
                  variant="light"
                >
                  {subtitlesExportOptionsList.map(({ type, label, ext }, index) => {
                    return (
                      <Dropdown.Item
                        key={index + label}
                        onClick={() => {
                          handleExport({ type, ext, isDownload: true });
                        }}
                      >
                        {label} (<code>.{ext}</code>)
                      </Dropdown.Item>
                    );
                  })}
                </DropdownButton>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                OverlayTrigger
                delay={TOOTLIP_LONGER_DELAY}
                placement={'bottom'}
                overlay={<Tooltip id="tooltip-disabled">Save</Tooltip>}
              >
                <Button disabled={isProcessing} onClick={handleSave} variant="light">
                  <FontAwesomeIcon icon={faSave} />
                </Button>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                delay={TOOTLIP_DELAY}
                placement={'bottom'}
                overlay={
                  <Tooltip id="tooltip-disabled">
                    To insert a paragraph break, and split a pargraph in two, put the cursor at a point where you'd want to add a paragraph break in
                    the text and either click this button or hit enter key
                  </Tooltip>
                }
              >
                <Button disabled={isProcessing} onClick={breakParagraph} variant="light">
                  {/* <FontAwesomeIcon icon={ faICursor } /> */}↵
                </Button>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                delay={TOOTLIP_DELAY}
                placement={'bottom'}
                overlay={
                  <Tooltip id="tooltip-disabled">Put the cursor at a point where you'd want to add [INAUDIBLE] text, and click this button</Tooltip>
                }
              >
                <Button disabled={isProcessing} onClick={insertTextInaudible} variant="light">
                  <FontAwesomeIcon icon={faMehBlank} />
                </Button>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger delay={TOOTLIP_DELAY} placement={'bottom'} overlay={<Tooltip id="tooltip-disabled">Insert a ♫ in the text</Tooltip>}>
                <span className="d-inline-block">
                  <Button onClick={handleInsertMusicNote} variant={'light'}>
                    <FontAwesomeIcon icon={faMusic} />
                  </Button>
                </span>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                delay={TOOTLIP_DELAY}
                placement={'bottom'}
                overlay={
                  <Tooltip id="tooltip-disabled">
                    Turn {isPauseWhiletyping ? 'off' : 'on'} pause while typing functionality. As you start typing the media while pause playback
                    until you stop. Not reccomended on longer transcript as it might present performance issues.
                  </Tooltip>
                }
              >
                <Button disabled={isProcessing} onClick={handleSetPauseWhileTyping} variant={isPauseWhiletyping ? 'secondary' : 'light'}>
                  <FontAwesomeIcon icon={faPause} />
                </Button>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                delay={TOOTLIP_DELAY}
                placement={'bottom'}
                overlay={
                  <Tooltip id="tooltip-disabled">
                    Restore timecodes. At the moment for transcript over 1hour it could temporarily freeze the UI for a few seconds
                  </Tooltip>
                }
              >
                <Button
                  disabled={isProcessing}
                  onClick={async () => {
                    try {
                      setIsProcessing(true);
                      await handleRestoreTimecodes();
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  variant="light"
                >
                  <FontAwesomeIcon icon={faSync} />
                </Button>
              </OverlayTrigger>
            </Col>
            <Col xs={2} sm={12} md={12} lg={12} xl={12} className={'p-1 mx-auto'}>
              <OverlayTrigger
                placement={'bottom'}
                overlay={
                  <Tooltip id="tooltip-disabled">
                    Double click on a paragraph to jump to the corresponding point at the beginning of that paragraph in the media
                  </Tooltip>
                }
              >
                {/* <span className="d-inline-block"> */}
                <Button disabled={isProcessing} variant="light">
                  <FontAwesomeIcon icon={faInfoCircle} />
                </Button>
                {/* </span> */}
              </OverlayTrigger>
            </Col>
          </Row>
          <br />
        </Col>
      </Row>
    </Container>
  );
}

SlateTranscriptEditor.propTypes = {
  transcriptData: PropTypes.object.isRequired,
  mediaUrl: PropTypes.string.isRequired,
  handleSaveEditor: PropTypes.func,
  handleAutoSaveChanges: PropTypes.func,
  autoSaveContentType: PropTypes.string,
  isEditable: PropTypes.boolean,
  showTimecodes: PropTypes.boolean,
  showSpeakers: PropTypes.boolean,
  title: PropTypes.string,
  showTitle: PropTypes.boolean,
  mediaType: PropTypes.string,
  transcriptDataLive: PropTypes.object,
};

SlateTranscriptEditor.defaultProps = {
  showTitle: false,
  showTimecodes: true,
  showSpeakers: true,
  mediaType: 'digitalpaperedit',
  isEditable: true,
};