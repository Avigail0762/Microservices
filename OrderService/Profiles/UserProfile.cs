using AutoMapper;
using OrderService.Models;
using OrderService.Models.DTO;

namespace OrderService.Profiles
{
    public class UserProfile : Profile
    {
        public UserProfile()
        {
            CreateMap<UserDTO, User>();
        }
    }
}
