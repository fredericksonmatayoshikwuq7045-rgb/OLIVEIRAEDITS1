import { useState } from 'react';
export type ResourceTab = 'media' | 'templates' | 'text' | 'presets' | 'fonts';
export type InspectorTab = 'basic' | 'timing' | 'audio' | 'file';
export function useEditorPanels() {
  const [resourceTab, setResourceTab] = useState<ResourceTab>('media');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('basic');
  return { resourceTab, setResourceTab, inspectorTab, setInspectorTab };
}
