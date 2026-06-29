import { registerRoot, Composition } from 'remotion';
import { WhiteboardComposition } from './WhiteboardComposition';
import type { VideoConfig } from './types';

const DEFAULT_CONFIG: VideoConfig = {
  topic: 'Video de ejemplo',
  accentColor: '#1b8e5a',
  boardStyle: 'classic',
  scenes: [
    {
      id: 1, type: 'title',
      title: 'Video de ejemplo',
      subtitle: 'Subtítulo',
      narration: 'Narración de ejemplo',
      bullets: [],
      duration: 150,
      audioUrl: null,
    },
  ],
};

registerRoot(() => (
  <Composition
    id="WhiteboardVideo"
    component={WhiteboardComposition}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ config: DEFAULT_CONFIG }}
  />
));
