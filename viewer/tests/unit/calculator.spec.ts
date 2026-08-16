import Calculator from '@/components/Calculator.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';

describe('Calculator.vue', () => {
    it('accumulates digits and emits the bid', () => {
        const wrapper = shallowMount(Calculator);
        const vm = wrapper.vm as any;

        vm.add(1);
        vm.add(2);
        expect(vm.value).to.equal(12);

        vm.del();
        expect(vm.value).to.equal(1);

        vm.bid();
        expect(wrapper.emitted().bid![0]).to.deep.equal([1]);
        expect(vm.value).to.equal(0);
    });
});
