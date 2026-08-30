import "./index.css";
import { Composition } from "remotion";
import { Film } from "./Film";
import beats from "./data/beats.json";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Placard"
    component={Film}
    durationInFrames={beats.filmFrames}
    fps={beats.fps}
    width={1920}
    height={1080}
  />
);
