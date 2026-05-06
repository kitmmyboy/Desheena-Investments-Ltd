import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Initialize mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

interface MapMarker {
  id: string
  lng: number
  lat: number
  label?: string
  color?: string
  popup?: string
  properties?: any
}

interface MapboxMapProps {
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  cluster?: boolean
  style?: React.CSSProperties
  className?: string
  onMapLoad?: (map: mapboxgl.Map) => void
}

export default function MapboxMap({
  center = [32.5825, 0.3476], // Kampala
  zoom = 12,
  markers = [],
  cluster = false,
  style,
  className,
  onMapLoad
}: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({})

  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom,
    })

    map.on('load', () => {
      mapRef.current = map
      
      if (cluster) {
        setupClusterSource(map)
      }

      if (onMapLoad) onMapLoad(map)
    })

    // Clean up on unmount
    return () => {
      map.remove()
    }
  }, [])

  const setupClusterSource = (map: mapboxgl.Map) => {
    map.addSource('markers', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    })

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'markers',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',
          100,
          '#f1f075',
          750,
          '#f28cb1'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          100,
          30,
          750,
          40
        ]
      }
    })

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'markers',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    })

    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      const clusterId = features[0].properties?.cluster_id
      const source = map.getSource('markers') as mapboxgl.GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        map.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: zoom ?? undefined
        })
      })
    })

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'markers',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], '#11b4da'],
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    })

    map.on('click', 'unclustered-point', (e) => {
      const coordinates = (e.features![0].geometry as any).coordinates.slice()
      const popup = e.features![0].properties?.popup

      if (popup) {
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popup)
          .addTo(map)
      }
    })

    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = ''
    })
  }

  // Update markers when they change
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (cluster && map.getSource('markers')) {
      const source = map.getSource('markers') as mapboxgl.GeoJSONSource
      source.setData({
        type: 'FeatureCollection',
        features: markers.map(m => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [m.lng, m.lat]
          },
          properties: {
            id: m.id,
            popup: m.popup,
            ...m.properties
          }
        }))
      })

      // We still need markers for individual points if they are not clustered
      // Or we can use layers. For simplicity with the existing popup logic, 
      // let's stick to markers for non-clustered view if cluster is false.
    } else {
      // Remove old markers
      const currentMarkerIds = new Set(markers.map(m => m.id))
      Object.keys(markersRef.current).forEach(id => {
        if (!currentMarkerIds.has(id)) {
          markersRef.current[id].remove()
          delete markersRef.current[id]
        }
      })

      // Add or update markers
      markers.forEach(m => {
        if (markersRef.current[m.id]) {
          markersRef.current[m.id].setLngLat([m.lng, m.lat])
        } else {
          const marker = new mapboxgl.Marker({ color: m.color })
            .setLngLat([m.lng, m.lat])

          if (m.popup) {
            marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(m.popup))
          }

          marker.addTo(map)
          markersRef.current[m.id] = marker
        }
      })
    }

    // Fit bounds if markers exist
    if (markers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      markers.forEach(m => bounds.extend([m.lng, m.lat]))
      map.fitBounds(bounds, { padding: 50, maxZoom: 15 })
    }
  }, [markers, cluster])

  return (
    <div 
      ref={mapContainerRef} 
      style={{ width: '100%', height: '100%', minHeight: '400px', ...style }} 
      className={className}
    />
  )
}
