import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActiveOrder } from '@/lib/types'
import { findNewOrders, useNewOrderTracker } from './newOrders'

const order = (id: number, statut: ActiveOrder['statut'] = 'EnAttente'): ActiveOrder => ({
  id,
  numero: `CMD-${id}`,
  statut,
  typeCommande: 'ARemporter',
  nomClient: 'x',
  tableNumero: null,
  note: null,
  dateCommande: '2024-06-01T10:00:00Z',
  dateMiseAJour: '2024-06-01T10:00:00Z',
  lignes: [],
  version: 1,
})

describe('findNewOrders', () => {
  it("jamais d'alerte au premier chargement", () => {
    expect(findNewOrders(null, [order(1), order(2)])).toEqual([])
  })

  it('détecte les commandes en attente absentes du relevé précédent', () => {
    expect(findNewOrders(new Set([1]), [order(1), order(2), order(3)])).toEqual([2, 3])
  })

  it('ignore les nouvelles commandes qui ne sont pas en attente', () => {
    expect(findNewOrders(new Set([1]), [order(1), order(2, 'EnPreparation')])).toEqual([])
  })

  it("aucune alerte si rien n'a changé", () => {
    expect(findNewOrders(new Set([1, 2]), [order(1), order(2)])).toEqual([])
  })
})

describe('useNewOrderTracker', () => {
  it('ne sonne pas au premier chargement, sonne à la commande suivante', () => {
    const onNew = vi.fn()
    const { result, rerender } = renderHook(({ orders }) => useNewOrderTracker(orders, { onNew }), {
      initialProps: { orders: undefined as ActiveOrder[] | undefined },
    })

    rerender({ orders: [order(1), order(2)] }) // premier chargement : 2 commandes déjà là
    expect(onNew).not.toHaveBeenCalled()
    expect(result.current.newCount).toBe(0)

    rerender({ orders: [order(1), order(2)] }) // deuxième relevé identique
    expect(onNew).not.toHaveBeenCalled()

    rerender({ orders: [order(1), order(2), order(3)] }) // une nouvelle commande
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onNew).toHaveBeenCalledWith([3])
    expect(result.current.newCount).toBe(1)
    expect([...result.current.newIds]).toEqual([3])
  })

  it('une commande déjà signalée ne re-sonne pas, même si elle réapparaît', () => {
    const onNew = vi.fn()
    const { rerender } = renderHook(({ orders }) => useNewOrderTracker(orders, { onNew }), {
      initialProps: { orders: [order(1)] as ActiveOrder[] | undefined },
    })
    rerender({ orders: [order(1), order(2)] })
    rerender({ orders: [order(1)] })
    rerender({ orders: [order(1), order(2)] })
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it("la pastille se vide au dismiss et quand la commande n'est plus en attente", () => {
    const { result, rerender } = renderHook(({ orders }) => useNewOrderTracker(orders), {
      initialProps: { orders: [order(1)] as ActiveOrder[] | undefined },
    })
    rerender({ orders: [order(1), order(2), order(3)] })
    expect(result.current.newCount).toBe(2)

    rerender({ orders: [order(1), order(2, 'EnPreparation'), order(3)] })
    expect(result.current.newCount).toBe(1)

    act(() => result.current.dismiss())
    expect(result.current.newCount).toBe(0)
  })

  it('plusieurs nouvelles commandes dans un même relevé : un seul appel', () => {
    const onNew = vi.fn()
    const { rerender } = renderHook(({ orders }) => useNewOrderTracker(orders, { onNew }), {
      initialProps: { orders: [order(1)] as ActiveOrder[] | undefined },
    })
    rerender({ orders: [order(1), order(2), order(3)] })
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onNew).toHaveBeenCalledWith([2, 3])
  })
})
