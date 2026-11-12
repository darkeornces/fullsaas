import { Link } from 'react-router-dom'
import Phone from '../components/Phone.tsx'

export default function Inicio() {
  return (
    <Phone className="justify-center gap-4 px-8">
      <h1 className="font-head text-4xl font-bold text-green">Fidelhop</h1>
      <Link to="/caja" className="rounded-full bg-ink py-4 text-center font-bold text-white">Ingresar a la tienda</Link>
    </Phone>
  )
}
