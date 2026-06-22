/**
 * Configuration Jest globale.
 *
 * Mock de react-native-svg : en environnement de test (react-test-renderer),
 * les composants natifs SVG ne sont pas disponibles. On les remplace par de
 * simples composants View pour que le rendu n'échoue pas.
 */

// Mock AsyncStorage : implémentation en mémoire minimale pour les tests.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {}
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(key in store ? store[key] : null)),
      setItem: jest.fn((key, value) => {
        store[key] = value
        return Promise.resolve()
      }),
      removeItem: jest.fn((key) => {
        delete store[key]
        return Promise.resolve()
      }),
      clear: jest.fn(() => {
        store = {}
        return Promise.resolve()
      }),
    },
  }
})

jest.mock('react-native-svg', () => {
  const React = require('react')
  const { View } = require('react-native')

  const mockComponent = (name) => {
    const Comp = (props) => React.createElement(View, { ...props, testID: props.testID ?? name })
    Comp.displayName = name
    return Comp
  }

  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Circle: mockComponent('Circle'),
    Ellipse: mockComponent('Ellipse'),
    G: mockComponent('G'),
    Path: mockComponent('Path'),
    Rect: mockComponent('Rect'),
    Line: mockComponent('Line'),
    Polyline: mockComponent('Polyline'),
    Polygon: mockComponent('Polygon'),
    Text: mockComponent('SvgText'),
    Defs: mockComponent('Defs'),
    Stop: mockComponent('Stop'),
    LinearGradient: mockComponent('LinearGradient'),
    ClipPath: mockComponent('ClipPath'),
  }
})
