import { Route, Routes } from 'react-router-dom'
import Inicio from './pages/Inicio.tsx'
import ClienteGate from './pages/ClienteGate.tsx'
import Tarjeta from './pages/Tarjeta.tsx'
import Escanear from './pages/Escanear.tsx'
import Sello from './pages/Sello.tsx'
import Fidelizado from './pages/Fidelizado.tsx'
import CajaGate from './pages/CajaGate.tsx'
import CajaInicio from './pages/CajaInicio.tsx'
import Fidelizar from './pages/Fidelizar.tsx'
import CajaBuscar from './pages/CajaBuscar.tsx'
import CajaSumar from './pages/CajaSumar.tsx'
import CajaEscanear from './pages/CajaEscanear.tsx'
import CajaOpciones from './pages/CajaOpciones.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/f/:codigo" element={<Fidelizado />} />
      <Route element={<ClienteGate />}>
        <Route path="/app" element={<Tarjeta />} />
        <Route path="/app/escanear" element={<Escanear />} />
        <Route path="/app/sello" element={<Sello />} />
      </Route>
      <Route path="/caja" element={<CajaGate />}>
        <Route index element={<CajaInicio />} />
        <Route path="fidelizar" element={<Fidelizar />} />
        <Route path="escanear" element={<CajaEscanear />} />
        <Route path="opciones" element={<CajaOpciones />} />
        <Route path="sumar" element={<CajaBuscar />} />
        <Route path="sumar/:codigo" element={<CajaSumar />} />
      </Route>
    </Routes>
  )
}
