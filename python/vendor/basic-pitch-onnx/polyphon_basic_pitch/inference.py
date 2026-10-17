#!/usr/bin/env python
# encoding: utf-8
#
# Copyright 2022 Spotify AB
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Polyphon modification: ONNX-only model loading; unused backend/CLI code removed.
import pathlib
from typing import Dict, Iterable, Tuple, Union
import librosa
import numpy as np
import numpy.typing as npt
import onnxruntime as ort
from .constants import AUDIO_SAMPLE_RATE, AUDIO_N_SAMPLES, ANNOTATIONS_FPS


class Model:
    def __init__(self, model_path):
        self.model = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    def predict(self, x):
        # Preserve Basic Pitch 0.4.0 output names and mapping exactly.
        return dict(zip(
            ["note", "onset", "contour"],
            self.model.run(
                ["StatefulPartitionedCall:1", "StatefulPartitionedCall:2", "StatefulPartitionedCall:0"],
                {"serving_default_input_2:0": x},
            ),
        ))


def window_audio_file(
    audio_original: npt.NDArray[np.float32], hop_size: int
) -> Iterable[Tuple[npt.NDArray[np.float32], Dict[str, float]]]:
    """
    Pad appropriately an audio file, and return as
    windowed signal, with window length = AUDIO_N_SAMPLES

    Returns:
        audio_windowed: tensor with shape (n_windows, AUDIO_N_SAMPLES, 1)
            audio windowed into fixed length chunks
        window_times: list of {'start':.., 'end':...} objects (times in seconds)

    """
    for i in range(0, audio_original.shape[0], hop_size):
        window = audio_original[i : i + AUDIO_N_SAMPLES]
        if len(window) < AUDIO_N_SAMPLES:
            window = np.pad(
                window,
                pad_width=[[0, AUDIO_N_SAMPLES - len(window)]],
            )
        t_start = float(i) / AUDIO_SAMPLE_RATE
        window_time = {
            "start": t_start,
            "end": t_start + (AUDIO_N_SAMPLES / AUDIO_SAMPLE_RATE),
        }
        yield np.expand_dims(window, axis=-1), window_time


def get_audio_input(
    audio_path: Union[pathlib.Path, str], overlap_len: int, hop_size: int
) -> Iterable[Tuple[npt.NDArray[np.float32], Dict[str, float], int]]:
    """
    Read wave file (as mono), pad appropriately, and return as
    windowed signal, with window length = AUDIO_N_SAMPLES

    Returns:
        audio_windowed: tensor with shape (n_windows, AUDIO_N_SAMPLES, 1)
            audio windowed into fixed length chunks
        window_times: list of {'start':.., 'end':...} objects (times in seconds)
        audio_original_length: int
            length of original audio file, in frames, BEFORE padding.

    """
    assert overlap_len % 2 == 0, f"overlap_length must be even, got {overlap_len}"

    audio_original, _ = librosa.load(str(audio_path), sr=AUDIO_SAMPLE_RATE, mono=True)

    original_length = audio_original.shape[0]
    audio_original = np.concatenate([np.zeros((int(overlap_len / 2),), dtype=np.float32), audio_original])
    for window, window_time in window_audio_file(audio_original, hop_size):
        yield np.expand_dims(window, axis=0), window_time, original_length


def unwrap_output(
    output: npt.NDArray[np.float32],
    audio_original_length: int,
    n_overlapping_frames: int,
) -> np.array:
    """Unwrap batched model predictions to a single matrix.

    Args:
        output: array (n_batches, n_times_short, n_freqs)
        audio_original_length: length of original audio signal (in samples)
        n_overlapping_frames: number of overlapping frames in the output

    Returns:
        array (n_times, n_freqs)
    """
    if len(output.shape) != 3:
        return None

    n_olap = int(0.5 * n_overlapping_frames)
    if n_olap > 0:
        # remove half of the overlapping frames from beginning and end
        output = output[:, n_olap:-n_olap, :]

    output_shape = output.shape
    n_output_frames_original = int(np.floor(audio_original_length * (ANNOTATIONS_FPS / AUDIO_SAMPLE_RATE)))
    unwrapped_output = output.reshape(output_shape[0] * output_shape[1], output_shape[2])
    return unwrapped_output[:n_output_frames_original, :]  # trim to original audio length


