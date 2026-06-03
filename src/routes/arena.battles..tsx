import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/arena/battles/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/arena/battles/"!</div>
}
