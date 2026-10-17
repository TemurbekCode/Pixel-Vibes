import './App.css'
import MusicPlayer from './components/MusicPlayer'
import Meadow from './components/farm&house/Meadow'
import Farm from './components/farm&land/Farm'
import NearCity from './components/nearcity/NearCity'
import Street from './components/street/Street'
import Village from './components/village/Village'

function App() {
  return (
    <>
      <MusicPlayer />
      <Farm />
      <Meadow />
      <Village />
      <NearCity />
      <Street />
    </>
  )
}

export default App