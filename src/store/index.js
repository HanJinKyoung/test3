import Vue from 'vue'
import Vuex from 'vuex'
import { process } from '@/common/Api.js';
import axios from 'axios';

Vue.use(Vuex)
// 사이드바와 지도 컴포넌트 리뷰 정보 공유
// 사이드바와 지도 컴포넌트 사아의 현재 선택된 위도, 경도 정보 공유
export default new Vuex.Store({
    state: {
        reviews: undefined,
        curLon: undefined,
        curLat: undefined,
        curReviewId: undefined,
        curTitle: undefined,
        curAddress: undefined,
        curGrade: undefined,
        curReview: undefined,
        isDisabledInput: undefined,
    },
    mutations: {
        setInputState: (state, bool) => {
          state.isDisabledInput = bool;
        },
        setReviews: (state, reviews) => {
          if (state.reviews && reviews &&
            state.reviews.length !== reviews.length) {
            const ids = state.reviews.map(re => re.id);
            const curReview = reviews.find(review => !ids.includes(review.id));
            if (curReview)
                state.curReviewId = curReview.id;
          }
          state.reviews = reviews;
          state.isDisabledInput = false;  //추가

          const review = reviews.find(review =>
            review.id === state.curReviewId
          );

          setReview(state, review);
        },
        setReview: (state, review) => {
          setReview(state, review);
        },
        setLonLat: (state, { lon, lat }) => {
            state.curLon = lon;
            state.curLat = lat;
        },
        setCurReviewId: (state, id) => {
            state.curReviewId = id;
        },
        setCurTitle: (state, title) => {
            state.curTitle = title;
        },
        setCurAddress: (state, address) => {
            state.curAddress = address;
        },
        setCurGrade: (state, grade) => {
            state.curGrade = grade;
        },
        setCurReview: (state, review) => {
            state.curReview = review;
        },
    },
    actions: {
      async setReviews({commit}, that) {
        await process(that, async () => {
          const result = await axios.get('/api/review/getReviews');
          await commit('setReviews', result.data);
          console.log(result);
        })
      }
    },
    modules: {}
})

function setReview(state, review) {
  state.curReviewId = review ? review.id : review;
  state.curLat = review ? review.lat : review;
  state.curLon = review ? review.lon : review;
  state.curTitle = review ? review.title : review;
  state.curGrade = review ? review.grade : review;
  state.curAddress = review ? review.address : review;
  state.curReview = review ? review.review : review;
}