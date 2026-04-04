// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = jest.fn();
}

if (!HTMLMediaElement.prototype.play) {
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
} else {
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
}

if (!HTMLMediaElement.prototype.pause) {
  HTMLMediaElement.prototype.pause = jest.fn();
} else {
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
}

if (!HTMLMediaElement.prototype.load) {
  HTMLMediaElement.prototype.load = jest.fn();
}

global.IS_REACT_ACT_ENVIRONMENT = true;
