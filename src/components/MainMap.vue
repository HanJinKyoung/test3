<template>
  <div class="main-map" ref="map">
    <div
        class="overlay-tooltip"
        ref="overlay"
        v-show="isShowOverlay"
    >
        <div class="overlay-content">
            {{ selectedOverlayText }}
            <BFormRating class="rating" v-model="selectedOverlayRating" readonly />
        </div>
    </div>
  </div>
</template>

<script>
import OlLayerTile from 'ol/layer/Tile.js';
import OlVectorSource from 'ol/source/Vector.js';
import OlVectorLayer from 'ol/layer/Vector.js';
import OlView from 'ol/View.js';
import OlMap from 'ol/Map.js';
import OlFeature from 'ol/Feature.js';
import OlPoint from 'ol/geom/Point.js';
import OSM from 'ol/source/OSM';
import OlStyle from 'ol/style/Style.js';
import OlIcon from 'ol/style/Icon.js';
import {fromLonLat, toLonLat, transform} from 'ol/proj.js'
import {defaults} from 'ol/control.js';
import axios from 'axios';
import Geocoder from 'ol-geocoder';
import Overlay from 'ol/Overlay';


const EPSG_3857 = 'EPSG:3857';
const EPSG_4326 = 'EPSG:4326';

export default {
  name: 'MainMap',
  data() {
    return {
      olMap: undefined,    
      iconsSource: undefined,
      overlay: undefined,
      isShowOverlay: false,
      selectedOverlayText: undefined,
      selectedOverlayRating: undefined,

    };
  },
  computed: {
    reviews(){
      return this.$store.state.reviews;
    }
  },
  watch: {
    async reviews() {
      if(this.vectorSource)
        this.vectorSource.clear();
      this.drawFeatures();
    }
  },
  async mounted() {
    const that =this;
    const vectorSource = new OlVectorSource(EPSG_3857); // 위치 정보 처리방식
    const vectorLayer = new OlVectorLayer({
      source: vectorSource,
    });

    this.olMap = new OlMap({
      target: this.$refs.map,
      controls : defaults({
        attribution : false,
        zoom : false,
        rotate: false,
      }),
      layers: [
          new OlLayerTile({
            source: new OSM()
          }),
          vectorLayer,
      ],
      view: new OlView({
        center: fromLonLat([126.9156516, 37.5570685]), // 마포구 위.경도 정보
        zoom: 15,
        projection: EPSG_3857  //생략가능
      })
    });

    await this.$store.dispatch('setReviews',this);

    const geocoder = new Geocoder('nominatim',{
      provider: 'osm',
      lang: 'kr',
      placeholder: '주소 검색',
      lmit: 5, //자동 완성 결과 최대 개수
      autoComplete: true,
      keepOpen: true
    });
    this.olMap.addControl(geocoder)

    geocoder.on('addresschosen',(evt) =>{
      that.setUiAddress(evt.address.details.name)
    });

    this.drawFeatures();
// 클릭하면 toLonLat(위경도)로 좌표계를  얻어옴
    this.olMap.on('pointermove', (e) => {
      that.olMap.getTargetElement().style.cursor = '';
      that.isShowOverlay = false;
      that.olMap.removeOverlay(that.overlay);

      that.olMap.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (feature.get('title') !== undefined) {
          that.isShowOverlay = true;
          that.selectedOverlayText = feature.get('title');
          that.selectedOverlayRating = feature.get('grade');

          const overlay = that.$refs.overlay;

          that.overlay = new Overlay({
            element: overlay,
            position: feature.getGeometry().getCoordinates(),
            positioning: 'bottom-center',
            offset: [0, -10],
          });
          that.olMap.addOverlay(that.overlay);
          that.olMap.getTargetElement().style.cursor = 'pointer';
        }
      });
    });

    //클릭하면 toLonLat로 좌표계를  얻어옴
    this.olMap.on('click',async (e) =>{
      this.vectorSource.clear();
      geocoder.getSource().clear();
      const [lon, lat] = toLonLat(e.coordinate);
      const addressInfo = await that.getAddress(lon, lat)
      console.log('lon : '+lon);
      console.log('lat : '+lat);
      this.$store.commit('setReview', undefined);
      this.$store.commit('setInputState', false); //추가
      this.$store.commit('setCurAddress', that.getUiAddress(addressInfo.data.display_name));
      that.$store.commit('setLonLat', { lon, lat });

      const point = that.coordi4326To3857([lon, lat]);
      const feature = new OlFeature({
        geometry: new OlPoint(point),
      });
      feature.setStyle(new OlStyle({
          image: new OlIcon({
            scale: 0.7,
            src: '//cdn.rawgit.com/jonataswalker/map-utils/master/images/marker.png',
          }),
        })
      );

      // vectorSource.addFeature(feature);
      const existFeature = that.olMap.forEachFeatureAtPixel(e.pixel, feature => {
        this.$store.commit('setCurTitle', feature.get('title'));
        this.$store.commit('setCurAddress', feature.get('address'));
        this.$store.commit('setCurGrade', feature.get('grade'));
        this.$store.commit('setCurReview', feature.get('review'));
        this.$store.commit('setCurReviewId', feature.get('reviewId'));
        this.$store.commit('setInputState', true);  //추가
        return true;
      });
      if (!existFeature) this.vectorSource.addFeature(feature);
    });

  },

  methods: {
    drawFeatures(){
      if (this.iconsSource) this.iconsSource.clear();

      this.iconsSource = new OlVectorSource(EPSG_3857);
      const iconsLayer = new OlVectorLayer({
        source: this.iconsSource
      });
      const style = new OlStyle({
        image: new OlIcon({
          scale: 0.8,
          src: require('../assets/images/spot.png')
        })
      });
      const features = this.reviews.map(review => {
        const point = this.coordi4326To3857([review.lon, review.lat]); //경도,위도 받아오기
        const feature = new OlFeature({
          geometry: new OlPoint(point)
        });
        feature.set('title', review.title);
        feature.set('grade', review.grade);
        feature.set('address', review.address);
        feature.set('review', review.review);
        feature.set('reviewId', review.id);
        feature.setStyle(style);

        console.log('feature 내용 : '+feature)
        return feature;
      });

      this.iconsSource.addFeatures(features);
      this.olMap.addLayer(iconsLayer);
    },
    getAddress (lon, lat) {
      return axios.get(
          'https://nominatim.openstreetmap.org/reverse',
          {
            params: {
              format: 'json',
              lon: lon,
              lat: lat
            }
          })
    },
    
    coordi4326To3857(coord) {
      // transform : 'ol/proj.js'에 있다
      return transform(coord, EPSG_4326, EPSG_3857); // EPSG_4326타입을 EPSG_3857타입으로
    },
    getUiAddress(str) {
      return str.split(', ').reverse().join(' ');
    },
    setUiAddress(str) {
      this.$root.$refs.sideBar.address = str.split(', ').reverse().join(' ');
    },
  }

}
</script>

<style lang="scss" scoped>
.main-map {
  width: 100%;
  height: 100%;

  .overlay-tooltip {
    border-radius: 5px;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    color: white;
    text-align: center;

    > .overlay-content::after {
      content: '';
      position: absolute;

      top: 100%;
      left: 50%;
      margin-left: -5px;

      border-width: 5px;
      border-style: solid;
      border-color: rgba(0, 0, 0, 0.5) transparent transparent transparent;
    }

    ::v-deep .rating {
      font-size: 15px;
      background-color: transparent;
      border: none;
      padding: 0;
      margin: 0;
      color: #ffdd00;
      height: unset;
    }
  }

  ::v-deep .ol-geocoder {
    position: absolute;
    right: 0;
    padding: 10px;

    button {
      display: none;
    }

    input::placeholder {
      color: white;
      opacity: 0.7;
    }

    input,
    ul {
      border-style: none;
      width: 200px;
      background-color: rgba(0, 0, 0, 0.5);
      border-radius: 5px;
      border-color: unset;
      padding: 0 5px;
      color: white;
    }

    ul {
      margin-top: 5px;
      padding: 0;
      list-style: none;

      li:hover {
        background-color: rgba(0, 0, 0, 0.3);
      }

      li {
        padding: 5px 10px;
        font-size: 13px;

        a {
          text-decoration: none;

          .gcd-road {
            color: white;
          }
        }
      }
    }
  }
}
</style>
